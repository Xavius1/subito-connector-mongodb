import { Fields, MongoDataSource, Options } from 'apollo-datasource-mongodb';
import { Datte } from 'subito-lib';
import type { Document, ObjectId } from 'mongodb';
import Helper from './Helper';
import Paginator from './Paginator';
import type { ICursor, IPaginatorInput } from './Paginator';

/** @public */
export type { Document } from 'mongodb';

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
  _id: never
  id: never
  slug?: string
  [key: string]: any
}

/** @public */
export interface IDocUpdateInput {
  id: MongoIdExt
  query: {
    $currentDate?: { [key: string]: boolean | { $type: 'timestamp' | 'date' } }
    $inc?: { [key: string]: number }
    $min?: { [key: string]: any }
    $max?: { [key: string]: any }
    $mul?: { [key: string]: number }
    $rename?: { [key: string]: string }
    $set?: IDocInput
    $setOnInsert?: { [key: string]: any }
    $unset?: {
      _id: never
      [key: string]: ''
    }
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
        throw new Error('SLUG_ALREADY_EXISTS');
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
      const insert = await this.collection.insertOne(
        this.prepareNewDoc(input),
      );
      return insert.ops[0];
    } catch (err) {
      console.log(err); // eslint-disable-line no-console
      throw new Error('SOMETHING WENT WRONG');
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
      throw new Error('SOMETHING WENT WRONG');
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
        throw new Error('SLUG_ALREADY_EXISTS');
      }
    }

    const doc = await this.findOneById(id);
    if (!doc) {
      throw new Error('DOC_NOT_FOUND');
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
      const { id, query } = input;
      const result = await this.collection.findOneAndUpdate({ _id: id }, query, { returnDocument: 'after' });
      this.deleteFromCacheById(id);
      return result.value;
    } catch (err) {
      console.log(err); // eslint-disable-line no-console
      throw new Error('SOMETHING WENT WRONG');
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
    return firstDoc;
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
    return this.findOneByFields({ slug }, options);
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
  public async findByCursor(input: IPaginatorInput, pipeline: Pipeline) {
    const paginator = new Paginator(input);
    paginator.setCursor(this.cursor);

    const data = await this.collection.aggregate(
      paginator.getPipeline(pipeline),
      { allowDiskUse: true },
    ).toArray();

    paginator.setPageInfo({
      total: (data[0].total[0]?.counter || 0),
      cursored: (data[0].cursored.total[0].counter || 0),
    });

    return paginator.get(data[0].cursored.current);
  }
}

export default Repository;
