/**
 * Handle MongoDB connections into Subito micro services
 *
 * @packageDocumentation
 */
export { default as Connector } from './Connector';
export { default as Helper } from './Helper';
export { default as Repository } from './Repository';
export { default as Paginator } from './Paginator';

// Types
export type {
  MongoDBLink, MongoDBName, MongoDBParams, MongoDBOptions,
} from './Connector';
export type { MatchFilter, IFilterPipelineInput, IFiltersPipeline } from './Helper';
export type {
  IPaginatorInput, IPageInfoInput, IPaginator, PaginatorOrder, CursorEdge, ICursor,
} from './Paginator';
export type {
  MongoId, MongoIdExt, MongoIdStr, IDocInput, IDocUpdateInput, DocumentResult, Pipeline, Document,
} from './Repository';
