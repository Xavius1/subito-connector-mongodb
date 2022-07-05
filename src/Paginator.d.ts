import { Document } from 'mongodb';
import type { ParseType } from 'subito-lib';
import type { IFilterPipelineInput } from './Helper.d';

export interface IPaginatorInput {
  first: number
  last: number
  before: string
  after: string
  filters: IFilterPipelineInput
}

export interface IPageInfoInput {
  total: number
  cursored: number
}

export interface IPaginator {
  // config: Function
  setPageInfo: Function
  getPipeline: Function
}

export type PaginatorOrder = 'ASC' | 'DESC';

export type CursorEdge = {
  cursor: string
  node: Document
}

export interface ICursor {
  field: string
  type: ParseType
}
