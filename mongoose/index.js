const mongoose = require("mongoose");
const ObjectId = require("mongodb").ObjectId;
const regexEscape = require("regex-escape");
const stringUtil = require("mandh-nodejs-utils").stringUtil;

const connections = {};

//This method returns mongodb id
const getId = () => new ObjectId().toString();

//Create mongoose model
const createModel = (model, collectionName, db = "default") =>
  connections[db] &&
  connections[db].model(
    collectionName,
    new mongoose.Schema(model),
    collectionName
  );

//This method creates connection of mongoose.
//It have to run first
const createConnection = async ({
  connectionString,
  dbName = "default",
  user,
  pass,
  keepAlive = true,
  useNewUrlParser = true,
  connectTimeoutMS = 10000,
  socketTimeoutMS = 10000,
  onConnection = () => {},
  onError = () => {},
}) => {
  if (connections[dbName]) {
    return connections[dbName];
  }

  connections[dbName] = mongoose.createConnection(connectionString, {
    dbName,
    connectTimeoutMS,
    keepAlive,
    pass,
    socketTimeoutMS,
    useNewUrlParser,
    user,
  });

  connections[dbName].on("error", (err) => {
    onError(err);
  });

  connections[dbName].on("open", () => {
    onConnection(connections[dbName]);
  });

  return connections[dbName];
};

//Clear all connections
const clearConnections = () => {
  connections = {};
};

//Get specific connection object
const getConnection = (db) => connections[db];

//Delete specific connection
const deleteConnection = (db) => delete connections[db];

//This class is db model. Models will be created from this class
const MandhDbModel = function (model, collectionName, db = "default") {
  const collectionSchema = new mongoose.Schema(model);

  this.model = connections[db].model(
    collectionName,
    collectionSchema,
    collectionName
  );

  //Find document by id.
  this.findById = async (id) => {
    return this.model.findOne({ id }).exec();
  };

  //Find document by specific field.
  this.findByField = async (field, value) => {
    const filterData = {};
    filterData[field] = value;

    return this.model.findOne(filterData).exec();
  };

  //Update document by id.
  this.updateById = async (id, data) => {
    const updateData = {
      updatedDate: new Date(),
    };

    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && key !== "id") updateData[key] = data[key];
    });

    return this.model.updateOne(
      { id },
      {
        $set: updateData,
      }
    );
  };

  //Update documents by custom query.
  this.updateByQuery = async (query, data) => {
    const updateData = {
      updatedDate: new Date(),
    };

    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && key !== "id") updateData[key] = data[key];
    });

    return (
      query &&
      Object.keys(query).length > 0 &&
      this.model.updateMany(query, {
        $set: updateData,
      })
    );
  };

  //List query for pageable, searchable lists.
  this.findListable = async ({
    take = 10,
    skip = 0,
    search = {
      fields: null,
      value: null,
    },
    sort = {
      by: null,
      type: "desc",
    },
    dateFilter = {
      field: null,
      start: null,
      end: null,
    },
  }) => {
    const filterData = {};
    const sortData = {};

    if (sort && sort.by && sort.type)
      sortData[sort.by] = sort.type !== "desc" ? -1 : 1;

    if (search && search.fields && search.value) {
      search.fields =
        typeof search.fields === "string" ? [search.fields] : search.fields;

      filterData.$or = search.fields.map((field) => {
        const searchData = {};
        searchData[field] = {
          $regex: new RegExp(
            ".*" +
              stringUtil.toTurkishSearchable(regexEscape(search.value)) +
              ".*"
          ),
        };

        return searchData;
      });
    }

    if (
      dateFilter &&
      dateFilter.field &&
      (dateFilter.start || dateFilter.end)
    ) {
      filterData.$and = [];

      if (dateFilter.start) {
        const dateFilterData = {};
        dateFilterData[dateFilter.field] = { $gte: dateFilter.start };

        filterData.$and.push(dateFilterData);
      }

      if (dateFilter.end) {
        const dateFilterData = {};
        dateFilterData[dateFilter.field] = { $lte: dateFilter.end };

        filterData.$and.push(dateFilterData);
      }
    }

    return this.model
      .find(filterData)
      .sort(sortData)
      .limit(take)
      .skip(skip)
      .exec();
  };

  //Returns mongoose model.
  this.getMongooseModel = () => {
    return this.model;
  };
};

module.exports = {
  MandhDbModel,
  clearConnections,
  createConnection,
  createModel,
  deleteConnection,
  getConnection,
  getId,
};
