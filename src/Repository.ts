import { Fields, MongoDataSource, Options } from 'apollo-datasource-mongodb';
import { Datte, ParseType } from 'subito-lib';
import type { Document, ObjectId } from 'mongodb';
import Helper from './Helper.js';
import Paginator from './Paginator.js';
import type { ICursor, IPaginatorInput } from './Paginator.js';

/** @public */
export type { Collection, Document } from 'mongodb';

/**
 * Classic MongoDB ID
 * @public
 */
export type MongoId = ObjectId;

/**
 * MongoDB can be an ObjectID or a string
 * @public
 */
export type MongoIdExt = ObjectId | string;

/**
 * MongoDB only string ID
 * @public
 */
export type MongoIdStr = string;

/** @public */
export interface IDocInput {
  _id?: never
  id?: never
  slug?: string
  [key: string]: any
}

export type GenericCursors = 'ID' | 'CREATION_DATE' | 'DELETION_DATE' | 'SLUG';

/** @public */
export interface IDocUpdateInput {
  id: MongoIdExt
  query: {
    $currentDate?: { [key: string]: boolean | { $type: 'timestamp' | 'date' } }
    $inc?: { [key: string]: number }
    $min?: { [key: string]: any }
    $max?: { [key: string]: any }
    $mul?: { [key: string]: number }
    $push?: { [key: string]: any }
    $rename?: { [key: string]: string }
    $set?: IDocInput
    $setOnInsert?: { [key: string]: any }
    $unset?: {
      [key: string]: ''
    }
  }
  params?: {
    arrayFilters: { [key: string]: any }[]
  }
}

/** @public */
export type DocumentResult = Document | null | undefined

/** @public */
export type Pipeline = ({ [key: string]: any })[]

/**
 * Abstract class to implement mongodb repository
 *
 * @public
 */
abstract class Repository extends MongoDataSource<Document> {
  /**
   * The cusor definition used by the Paginator
   */
  protected cursor: ICursor = {
    field: 'createdAt',
    type: 'Date',
  };

  /**
   * Check if the doc can be inserted into the DB
   *
   * @param input - The new doc to checked
   * @returns
   *
   * @public
   */
  public async canBeInserted(input: IDocInput): Promise<boolean> {
    const { slug } = input;
    if (slug) {
      const docWithSlug = await this.findOneBySlug(slug);
      if (docWithSlug) {
        throw new Error('409');
      }
    }

    return true;
  }

  /**
   * Get the current date using Datte class from subito-lib
   *
   * @returns
   *
   * @public
   */
  public getDate(): Date { // eslint-disable-line class-methods-use-this
    const d = new Datte();
    return d.toDate();
  }

  /**
   * Set a generic cursor
   *
   * @param name - the name of the cursor
   * @returns
   *
   * @public
   */
  public setGenericCursor(name: GenericCursors) {
    let cursor = null;
    let type: ParseType | 'Date' = 'Date';

    switch (name) {
      case 'CREATION_DATE':
        cursor = 'createdAt';
        break;
      case 'DELETION_DATE':
        cursor = 'deletedAt';
        break;
      case 'SLUG':
        cursor = 'slug';
        type = undefined;
        break;
      case 'ID':
        cursor = '_id';
        type = undefined;
        break;
      default:
    }

    if (cursor) {
      this.cursor = {
        field: cursor,
        type,
      };
    }

    return this;
  }

  /**
   * Add needed data to the doc before insertion
   *
   * @param doc - The doc to insert
   * @returns
   *
   * @public
   */
  public prepareNewDoc(doc: IDocInput): Document {
    const toSave: Document = { ...doc };
    toSave._id = Helper.newMongoId(true); // eslint-disable-line no-underscore-dangle
    toSave.createdAt = this.getDate();

    return toSave;
  }

  /**
   * Insert a new doc
   *
   * @param input - The new doc to insert
   * @returns
   *
   * @public
   */
  public async createDoc(input: IDocInput): Promise<DocumentResult> {
    this.canBeInserted(input);

    try {
      const doc = this.prepareNewDoc(input);
      await this.collection.insertOne(doc);
      return { ...doc, id: doc._id }; // eslint-disable-line no-underscore-dangle
    } catch (err) {
      console.log(err); // eslint-disable-line no-console
      throw new Error('500');
    }
  }

  /**
   * Create a list of documents
   *
   * @param arr - List of the docs to insert
   * @returns
   *
   * @public
   */
  public async createManyDocs(arr: IDocInput[]): Promise<DocumentResult[]> {
    const docs: Document[] = [];
    arr.forEach((input) => {
      this.canBeInserted(input);
      docs.push(this.prepareNewDoc(input));
    });

    try {
      const insert = await this.collection.insertMany(docs);

      return insert.ops;
    } catch (err) {
      console.log(err); // eslint-disable-line no-console
      throw new Error('500');
    }
  }

  /**
   * Check if the doc can be updated
   *
   * @param input - Operation to execute
   * @returns
   *
   * @public
   */
  public async canBeUpdated({ id, query }: IDocUpdateInput): Promise<boolean> {
    const { $set } = query;
    if ($set && $set.slug) {
      const docWithSlug = await this.findOneBySlug($set.slug);
      if (docWithSlug && docWithSlug._id !== id) { // eslint-disable-line no-underscore-dangle
        throw new Error('409');
      }
    }

    const doc = await this.findOneById(id);
    if (!doc) {
      throw new Error('404');
    }

    return true;
  }

  /**
   * Update a doc with its id
   *
   * @param input - Input values
   * @returns
   *
   * @public
   */
  public async updateDoc(input: IDocUpdateInput): Promise<DocumentResult> {
    this.canBeUpdated(input);

    try {
      const { id, query, params = {} } = input;
      const { value: doc } = await this.collection.findOneAndUpdate(
        { _id: id },
        query,
        { ...params, returnDocument: 'after' },
      );
      this.deleteFromCacheById(id);
      return { ...doc, id: doc._id }; // eslint-disable-line no-underscore-dangle
    } catch (err) {
      console.log(err); // eslint-disable-line no-console
      throw new Error('500');
    }
  }

  /**
   * Delete a document by its ID (soft)
   *
   * @remarks
   * It makes a soft deletion, the doc still exists into the db with a field "deleteAt"
   *
   * @param id - ID of the document to delete
   * @returns
   *
   * @public
   */
  public async deleteById(id: MongoIdExt) {
    return this.collection.updateOne({ _id: id }, { $set: { deleteAt: this.getDate() } });
  }

  /**
   * Delete a document by its ID (hard)
   *
   * @remarks
   * It removes the doc from the DB, still prefer a soft deletion with {@link Repository.deleteById}
   *
   * @param id - ID of the document to HARD delete
   * @returns
   *
   * @public
   */
  public async hardDeleteById(id: MongoIdExt) {
    return this.collection.deleteOne({ _id: id });
  }

  /**
   * Delete a list of document by their IDs (soft)
   *
   * @remarks
   * It makes a soft deletion, docs still exist into the db with a field "deleteAt"
   *
   * @param ids - An array of doc id
   * @returns
   */
  public async deleteManyById(ids: MongoIdExt[]) {
    return this.collection.updateMany(
      { _id: { $in: ids } },
      { $set: { deleteAt: this.getDate() } },
    );
  }

  /**
   * Delete a document by its ID (hard)
   *
   * @remarks
   * It removes docs from the DB, still prefer a soft deletion {@link Repository.deleteManyById}
   *
   * @param ids - An array of doc id
   * @returns
   *
   * @public
   */
  public async hardDeleteManyById(ids: MongoIdExt[]) {
    return this.collection.deleteMany({ _id: { $in: ids } });
  }

  /**
   * Find one doc by id or throw error if doc is not found
   * @param id - The doc id
   * @returns
   *
   * @public
   */
  async findOneById(id: string | ObjectId): Promise<Document | null> {
    const doc = await super.findOneById(id);
    return doc ? { ...doc, id: doc._id } : null; // eslint-disable-line no-underscore-dangle
  }

  /**
   * Find one doc by id or throw error if doc is not found
   * @param id - The doc id
   * @returns
   *
   * @public
   */
  async findOneByIdOrThrow(id: MongoIdStr): Promise<Document> {
    const doc = await this.findOneById(id);
    if (!doc) {
      throw new Error('404');
    }

    return { ...doc, id: doc._id }; // eslint-disable-line no-underscore-dangle
  }

  /**
   * Find one doc by specifics fields
   *
   * @param fields - The fields to match
   * @param options - Data source options
   * @returns
   *
   * @public
   */
  public async findOneByFields(fields: Fields, options?: Options): Promise<DocumentResult> {
    const [firstDoc] = await this.findByFields(fields, options);

    if (!firstDoc) {
      return null;
    }

    return { ...firstDoc, id: firstDoc._id }; // eslint-disable-line no-underscore-dangle
  }

  /**
   * Find docs by specifics fields
   *
   * @param fields - The fields to match
   * @param options - Data source options
   * @returns
   *
   * @public
   */
  public async findByFields(
    fields: Fields,
    options?: Options,
  ): Promise<(Document | null | undefined)[]> {
    const docs = await super.findByFields(fields, options);

    if (!docs) {
      return docs;
    }

    return docs.map(
      (doc) => (doc ? { ...doc, id: doc._id } : null), // eslint-disable-line no-underscore-dangle
    );
  }

  /**
   * Find a doc by its slug
   *
   * @param slug - The slug to match
   * @param options - Data source options
   * @returns
   *
   * @public
   */
  public async findOneBySlug(slug: string, options?: Options): Promise<DocumentResult> {
    const doc = await this.findOneByFields({ slug }, options);

    if (!doc) {
      return null;
    }

    return { ...doc, id: doc._id }; // eslint-disable-line no-underscore-dangle
  }

  /**
   * Get a list of paginated documents
   *
   * @param input - Define how you want to paginate
   * @param pipeline - Custom pipeline to get a subset of docs
   * @returns
   *
   * @public
   */
  public async findByCursor(input: IPaginatorInput, pipeline: Pipeline = []) {
    const paginator = new Paginator(input);
    paginator.setCursor(this.cursor);

    const [data] = await this.collection.aggregate(
      paginator.getPipeline(pipeline),
      { allowDiskUse: true },
    ).toArray();

    paginator.setPageInfo({
      total: (data.total[0]?.counter || 0),
      cursored: (data.cursored[0]?.counter || 0),
      current: (data.current?.length || 0),
    });

    return paginator.get(
      data.current.map(
        (doc: Document) => ({ ...doc, id: doc._id }), // eslint-disable-line no-underscore-dangle
      ),
    );
  }

  /**
   * Get all documents without pagination
   *
   * @remarks
   * To use with caution, because it can be very heavy & expensive
   *
   * @param options - Some options
   * @returns
   *
   * @public
   */
  async findAll({ sort = 'createdAt', order = 'ASC' }): Promise<DocumentResult[]> {
    return this.collection.find(
      {},
      { sort: { [sort]: (order === 'ASC' ? 1 : -1) } },
    ).toArray().map(
      (doc: Document) => ({ ...doc, id: doc._id }), // eslint-disable-line no-underscore-dangle
    );
  }
}

export default Repository;
