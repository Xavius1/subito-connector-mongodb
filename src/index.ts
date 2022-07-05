/**
 * Handle MongoDB connections into Subito micro services
 *
 * @packageDocumentation
 */

// /**
//  * MongoDB pipeline
//  * @public
//  */
// export type Pipeline = any[];

// /**
//  * MongoDB update
//  * @public
//  */
// export interface Update {
//   [key: string]: any;
// }

// /**
//  * MongoDB selector
//  * @public
//  */
// export interface Selector {
//   [key: string]: any;
// }

// export type { Document } from 'mongodb';

export { default as MongoDBConnector } from './Connector.js';
export { default as MongoDBHelper } from './Helper.js';
export { default as MongoDBRepository } from './Repository.js';
export { default as MongoDBPaginator } from './Paginator.js';
