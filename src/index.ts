import type { ObjectId } from 'mongodb';

/**
 * Handle MongoDB connections into Subito micro services
 *
 * @packageDocumentation
 */

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

/**
 * MongoDB pipeline
 * @public
 */
export type Pipeline = any[];

/**
 * MongoDB update
 * @public
 */
export interface Update {
  [key: string]: any;
}

/**
 * MongoDB selector
 * @public
 */
export interface Selector {
  [key: string]: any;
}

export type { Document } from 'mongodb';

export { default as MongoDBConnector } from './connector.js';
export type {
  MongoDBLink, MongoDBName, MongoDBParams, MongoDBOptions,
} from './connector.js';

export { default as MongoDBHelper } from './helper.js';
export { default as MongoDBRepository } from './Repository.js';
export { default as MongoDBPaginator } from './Paginator.js';
