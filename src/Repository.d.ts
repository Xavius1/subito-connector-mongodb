import type { Document, ObjectId } from 'mongodb';

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

export interface IDocInput {
  _id: never
  id: never
  slug?: string
  [key: string]: any
}

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

export type IDocumentResult = Document | null | undefined

export type Pipeline = ({ [key: string]: any })[]
