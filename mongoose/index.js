const mongoose = require('mongoose');
const ObjectId = require('mongodb').ObjectId;
const regexEscape = require("regex-escape");
const stringUtil = require('mandh-nodejs-utils').stringUtil;

//Field types
const fieldTypes = {
    string: String,
    number: Number,
    object: Object,
    date: Date,
    boolean: Boolean,
    array: Array
}

//This method returns mongodb id
const getId = () => new ObjectId().toString();

//This method creates connection of mongoose.
//It have to run first
const createConnection = async ({
    connectionString,
    dbName = 'default',
    keepAlive = true,
    useNewUrlParser = true,
    useCreateIndex = true,
    connectTimeoutMS = 10000,
    socketTimeoutMS = 10000,
    onConnection = () => { },
    onError = () => { }
}) => {
    if (mongoose[dbName]) {
        onConnection(mongoose[dbName]);
        return mongoose[dbName];
    }

    return new Promise((res, rej) => {
        mongoose[dbName] = mongoose.createConnection(connectionString, {
            keepAlive,
            useNewUrlParser,
            useCreateIndex,
            connectTimeoutMS,
            socketTimeoutMS,
        });

        mongoose[dbName].then(() => {
            res(mongoose[dbName]);
            onConnection(mongoose[dbName]);
        }).catch((err) => {
            onError(err);
        })
    })
}

//This class is db model. Models will be created from this class
const MandhDbModel = function (model, collectionName, db) {
    const mongoose = require('mongoose');

    db = db || 'default';
    const collectionSchema = new mongoose.Schema(model);

    this.model = mongoose[db].model(collectionName, collectionSchema, collectionName);

    this.findListable = async ({
        take = 10,
        skip = 0,
        search,
        sortBy,
        sortType = "asc",
        dateFilter,
    }) => {
        const filterData = {};
        const sortData = {};

        if (sortBy && sortType)
            sortData[sortBy] = sortType === "asc" ? -1 : 1;

        if (search && search.fields && search.value) {
            search.fields = typeof search.fields === "string" ? [search.fields] : search.fields;

            filterData.$or = search.fields.map(field => {
                const searchData = {};
                searchData[field] = { $regex: new RegExp('.*' + stringUtil.toTurkishSearchable(regexEscape(search.value)) + '.*') };

                return searchData
            })
        }

        if (dateFilter && dateFilter.field && (dateFilter.start || dateFilter.end)) {
            filterData.$and = [];

            if (dateFilter.start) {
                const dateFilterData = {};
                dateFilterData[dateFilter.field] = { $gte: dateFilter.start };

                filterData.$and.push(dateFilterData)
            }

            if (dateFilter.end) {
                const dateFilterData = {};
                dateFilterData[dateFilter.field] = { $lte: dateFilter.end };

                filterData.$and.push(dateFilterData)
            }
        }

        return this.model.find(filterData)
            .sort(sortData)
            .limit(take)
            .skip(skip)
            .exec();
    }

    this.getMongooseModel = () => { return this.model; }
}

module.exports = {
    MandhDbModel,
    createConnection,
    getId,
    fieldTypes
}