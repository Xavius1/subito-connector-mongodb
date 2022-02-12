import { MongoDataSource } from 'apollo-datasource-mongodb';
import type { Fields, Options } from 'apollo-datasource-mongodb';
import moment from 'moment';
import { Checker } from 'subito-lib';
import get from 'get-value';
import Helper from './helper.js';
import type {
  Document, MongoIdExt, Pipeline, Update,
} from './index.js';
import type { IPaginator } from './Paginator.js';

interface IMapper {
  [key: string]: any
  get: Function
}

interface IEntity {
  [key: string]: any
  Mapper: IMapper
  get: Function
}

const checker = new Checker(true);

class Repository extends MongoDataSource<string> {
  collection: any;

  deleteFromCacheById: any;

  findByFields: any;

  findOneById: any;

  findManyById: any;

  protected Mapper: any;

  getDate() { // eslint-disable-line class-methods-use-this
    return moment.utc().toDate();
  }

  async insertOne(doc: Document) {
    try {
      const toSave: any = { ...doc };
      toSave._id = Helper.newMongoId(true); // eslint-disable-line no-underscore-dangle
      toSave.createdAt = this.getDate();
      const insert = await this.collection.insertOne(toSave);
      return {
        result: true,
        doc: insert.ops[0],
      };
    } catch (e) {
      return {
        result: false,
        err: e,
      };
    }
  }

  async updateOneById(id: MongoIdExt, update: Update) {
    try {
      const result = await this.collection.findOneAndUpdate({ _id: id }, update, { returnDocument: 'after' });
      this.deleteFromCacheById(id);
      return {
        result: true,
        doc: this.entity(result.value),
      };
    } catch (e) {
      return {
        result: false,
        err: e,
      };
    }
  }

  async insertMany(docs: Document[]) {
    try {
      const toSaves: Document[] = [];
      docs.forEach((doc) => {
        const toSave = { ...doc };
        toSave._id = Helper.newMongoId(true); // eslint-disable-line no-underscore-dangle
        toSave.createdAt = this.getDate();
        toSaves.push(toSave);
      });
      const insert = await this.collection.insertMany(toSaves);
      return {
        result: true,
        docs: insert.ops,
      };
    } catch (e) {
      return {
        result: false,
        err: e,
      };
    }
  }

  getType() {
    return this.collection.namespace;
  }

  async deleteById(id: MongoIdExt) {
    return this.collection.updateOne({ _id: id }, { $set: { softDelete: this.getDate() } });
  }

  async hardDeleteById(id: MongoIdExt) {
    return this.collection.deleteOne({ _id: id });
  }

  async deleteManyById(ids: MongoIdExt[]) {
    return this.collection.updateMany(
      { _id: { $in: ids } },
      { $set: { softDelete: new Date() } },
    );
  }

  async hardDeleteManyById(ids: MongoIdExt[]) {
    return this.collection.deleteMany({ _id: { $in: ids } });
  }

  async bulkWrite(queries: any[]) {
    checker.isEmpty(queries);
    return this.collection.bulkWrite(queries);
  }

  entity(doc: Document) {
    const entity: IEntity = {
      ...doc,
      Mapper: this.Mapper,
      get(field: string): keyof Document {
        return get(this, this.Mapper.get(field), { default: this[field] });
      },
    };

    entity.get.bind(entity);

    return entity;
  }

  async getOneById(id: MongoIdExt) {
    const doc = await this.findOneById(id);
    return this.entity(doc);
  }

  async getManyById(ids: MongoIdExt[]) {
    const docs = await this.findManyById(ids);
    // return docs;
    return docs.map((doc: Document) => this.entity(doc));
  }

  async getOneBy(fields: Fields) {
    return this.entity(
      await this.collection.findOne(fields),
    );
  }

  async getOneByFields(fields: Fields, options: Options) {
    const docs = await this.findByFields(fields, options);
    if (docs.length > 0) {
      return this.entity(docs[0]);
    }
    return null;
  }

  async getManyByFields(fields: Fields, options: Options) {
    const docs = await this.findByFields(fields, options);
    return docs.map((doc: Document) => this.entity(doc));
  }

  async getAll(options: Options) {
    const docs = await this.findByFields({}, options);
    return docs.map((doc: Document) => this.entity(doc));
  }

  async getManyBy(fields: Fields) {
    return this.entity(
      await this.collection.find(fields),
    );
  }

  async paginate(paginator: IPaginator, pipeline: Pipeline = []) {
    const data = await this.collection.aggregate(
      paginator.toPipeline(pipeline),
      { allowDiskUse: true },
    ).toArray();

    paginator.setPageInfo({
      total: (data[0].total[0]?.counter || 0),
      cursored: (data[0].cursored.total[0].counter || 0),
    });

    return data[0].cursored.current;
  }
}

export default Repository;
