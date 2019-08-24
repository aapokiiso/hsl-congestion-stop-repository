'use strict';

const Sequelize = require('sequelize');
const hslGraphQL = require('@aapokiiso/hsl-congestion-graphql-gateway');
const { db } = require('@aapokiiso/hsl-congestion-db-schema');
const NoSuchStopError = require('./src/no-such-stop-error');
const CouldNotSaveStopError = require('./src/could-not-save-stop-error');

module.exports = {
    async getList() {
        const stops = await db().models.Stop.findAll();

        return stops;
    },
    async getListByIds(stopIds) {
        const stops = await db().models.Stop.findAll({
            where: {
                id: {
                    [Sequelize.Op.in]: stopIds,
                },
            },
        });

        return stops;
    },
    /**
     * @param {string} stopId
     * @returns {Promise<object>}
     * @throws NoSuchStopError
     */
    async getById(stopId) {
        const stop = await db().models.Stop.findByPk(stopId);

        if (!stop) {
            throw new NoSuchStopError(
                `No stop found with ID '${stopId}'`
            );
        }

        return stop;
    },
    /**
     * @param {string} stopId
     * @returns {Promise<object>}
     * @throws CouldNotSaveStopError
     */
    async createById(stopId) {
        try {
            const stopData = await findDataFromApi(stopId);

            return await createStopToDb(stopId, stopData);
        } catch (e) {
            throw new CouldNotSaveStopError(
                `Could not save stop with ID '${stopId}'. Reason: ${e.message}`
            );
        }
    },
    /**
     * @param {string} stopId
     * @param {string} routePatternId
     * @returns {Promise<void>}
     * @throws CouldNotSaveStopError
     */
    async associateToRoutePattern(stopId, routePatternId) {
        const [stop, routePattern] = await Promise.all([
            await db().models.Stop.findByPk(stopId),
            await db().models.RoutePattern.findByPk(routePatternId),
        ]);

        if (!stop) {
            throw new CouldNotSaveStopError(
                `No stop found with ID '${stopId}' to associate to route pattern with ID '${routePatternId}'`
            );
        }

        if (!routePattern) {
            throw new CouldNotSaveStopError(
                `No route pattern found with ID '${routePatternId}' to associate to stop with ID '${stopId}'`
            );
        }

        try {
            await routePattern.addStop(stop);
        } catch (e) {
            throw new CouldNotSaveStopError(
                `Could not associate stop with ID '${stopId}' to route pattern with ID '${routePatternId}'. Reason: ${e.message}`
            );
        }
    },
};

async function findDataFromApi(stopId) {
    const { stop } = await hslGraphQL.query(
        `{
            stop(id: "${stopId}") {
                name
                lat
                lon
            }
        }`,
        {
            priority: hslGraphQL.requestPriority.high,
        }
    );

    return stop;
}

async function createStopToDb(stopId, stopData) {
    const {
        name,
        lat: latitude,
        lon: longitude,
    } = stopData;

    const [stop] = await db().models.Stop.findOrCreate({
        where: {
            id: stopId,
            name,
            latitude,
            longitude,
        },
    });

    return stop;
}

