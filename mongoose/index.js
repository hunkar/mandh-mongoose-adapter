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
    this.mongoose = require('mongoose');

    this.db = db || 'default';
    const collectionSchema = new this.mongoose.Schema(model);

    this.model = this.mongoose[this.db].model(collectionName, collectionSchema, collectionName);


    //Check is id exist on db.
    this.isIdExist = async (id) => {
        return this.model.exists({ id });
    }

    //Check exists with custom query.
    this.isQueryExist = async (query) => {
        return this.model.exists(query);
    }

    //Create new document.
    this.create = async (data) => {
        data.createdDate = new Date();

        return this.model.create(data);
    }

    //Find document by id.
    this.findById = async (id) => {
        return this.model.findOne({ id }).exec();
    }

    //Find document by specific field.
    this.findByField = async (field, value) => {
        const filterData = {};
        filterData[field] = value;

        return this.model.findOne(filterData).exec();
    }

    //Find document with custom query.
    this.findByQuery = async (query) => {
        return this.model.findOne(query).exec();
    }

    //List documents with custom query.
    this.list = async (query) => {
        return this.model.find(query || {}).exec();
    }

    //Delete document by id.
    this.deleteById = async (id) => {
        return this.model.deleteOne({ id });
    }

    //Delete documents by custom query.
    this.deleteByQuery = async (query) => {
        return query && this.model.deleteMany(query);
    }

    //Update document by id.
    this.updateById = async (id, data) => {
        const updateData = {
            updatedDate: new Date()
        };

        Object.keys(data).forEach((key) => {
            if (data[key] !== undefined && key !== "id")
                updateData[key] = data[key];
        })

        return this.model.updateOne({ id }, {
            $set: updateData
        })
    }

    //Update documents by custom query.
    this.updateByQuery = async (query, data) => {
        const updateData = {
            updatedDate: new Date()
        };

        Object.keys(data).forEach((key) => {
            if (data[key] !== undefined && key !== "id")
                updateData[key] = data[key];
        })

        return query && Object.keys(query).length > 0 && this.model.updateMany(query, {
            $set: updateData
        })
    }

    //List query for pageable, searchable lists.
    this.findListable = async ({
        take = 10,
        skip = 0,
        search = {
            fields: null,
            value: null
        },
        sort = {
            by: null,
            type: "desc"
        },
        dateFilter = {
            field: null,
            start: null,
            end: null
        },
    }) => {
        const filterData = {};
        const sortData = {};

        if (sort && sort.by && sort.type)
            sortData[sort.by] = sort.type !== "desc" ? -1 : 1;

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

    //Returns mongoose model.
    this.getMongooseModel = () => { return this.model; }

    //Add custom function to model.
    this.registerCustomFunction = (fnName, fn) => {
        this[fnName] = fn;
    }
}

module.exports = {
    MandhDbModel,
    createConnection,
    getId,
    fieldTypes
}