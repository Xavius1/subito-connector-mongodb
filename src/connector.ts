import mongodb from 'mongodb';
import type {
  MongoDBLink, MongoDBName, MongoDBOptions, MongoDBParams,
} from './Connector.d';

/**
 * Create a new MongoDB connection
 *
 * @example
 * ```
 * new MongoDBConnector(
 *    'mongodb://mongodb:27017/',
 *    'subito',
 *    {
 *      authSource: 'admin',
 *      replicaSet: 'rs0',
 *    }
 * );
 * ```
 *
 * @param link - MongoDB server link
 * @param dbName - Name of the mongodb database
 * @param params - Connection parameters
 * @param options - Connection options
 *
 * @public
 */
class Connector {
  protected db: any;

  protected link: MongoDBLink;

  protected dbName: MongoDBName;

  protected params: string;

  protected options: MongoDBOptions;

  constructor(
    link: MongoDBLink,
    dbName: MongoDBName,
    params: MongoDBParams = {},
    options: MongoDBOptions = {},
  ) {
    this.db = null;
    this.link = link;
    this.dbName = dbName;
    this.params = Object.entries(params).reduce(
      (str, [param, value]) => {
        str += `${param}=${value}&`; // eslint-disable-line no-param-reassign
        return str;
      },
      '?',
    );
    const defaultOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      keepAlive: true,
    };
    this.options = { ...defaultOptions, ...options };
  }

  /**
   * Connect to the DB
   *
   * @returns
   *
   * @public
   */
  async connect() {
    try {
      const client = await mongodb.MongoClient.connect(
        `${this.link}${this.dbName}${this.params}`,
        this.options,
      );
      this.db = client.db(this.dbName);

      return this.db;
    } catch (err: any) {
      throw new Error(err);
    }
  }

  /**
   * Get the connection
   *
   * @public
   */
  get() {
    return this.db;
  }
}

export default Connector;
