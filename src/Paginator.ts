import { Calculator, Datte } from 'subito-lib';
import type { ParseType } from 'subito-lib';
import type { Document } from 'mongodb';
import type { Pipeline } from './Repository';
import Helper from './Helper';
import type { IFilterPipelineInput } from './Helper';

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

/**
 * Class to implements the cursor paginator pattern
 *
 * @remarks
 * Specs by relayjs {@link https://relay.dev/graphql/connections.htm}
 * Default cusor is based on the "createdAt" field, you can anything that
 * sortable & unique as "slug"
 *
 * @param args - Configure the paginator
 *
 * @public
 */
class Paginator implements IPaginator {
  protected order: PaginatorOrder;

  protected limit: number = 0;

  protected field: string = 'createdAt';

  protected filters: IFilterPipelineInput;

  protected type: ParseType = 'Date';

  protected value: string | null = null;

  protected hasNextPage: boolean = false;

  protected hasPreviousPage: boolean = false;

  protected currentPage: number = 0;

  protected totalPage: number = 0;

  protected totalResults: number = 0;

  constructor({
    first,
    last,
    before,
    after,
    filters,
  }: IPaginatorInput) {
    this.limit = first || last;
    this.order = first ? 'ASC' : 'DESC';
    this.value = first ? after : before;
    this.filters = filters;
  }

  /**
   * Set a custom cursor
   *
   * @example
   * ```
   * // Use the "slug" field as cursor
   * paginator.setCursor({ field: 'slug', type: 'string' });
   * ```
   *
   * @param input - Configuration of the new cursor
   * @returns
   *
   * @public
   */
  public setCursor({ field, type }: ICursor) {
    if (/__proto__/.test(field)) {
      throw new Error('Reserved word can not be used as field');
    }

    this.field = field;
    this.type = type;
    return this;
  }

  /**
   * Define page info from results
   *
   * @param input - The data needed to calculate page info
   * @returns
   *
   * @public
   */
  public setPageInfo({ total = 0, cursored = 0 }: IPageInfoInput) {
    const { limit, order } = this;
    const previousResults = (total - cursored);
    this.totalResults = total;
    this.hasNextPage = (cursored - limit > 0);
    this.hasPreviousPage = (previousResults > 0);
    this.totalPage = (total > 0) ? Math.ceil(total / limit) : 0;
    this.currentPage = 1;
    if (previousResults) {
      this.currentPage = Calculator.round(Math.ceil(previousResults / this.limit) + 1);
    }
    if (order === 'DESC') {
      this.currentPage = Calculator.round(this.totalPage - this.currentPage + 1);
    }

    return this;
  }

  /**
   * Get the cursor value from a doc
   *
   * @param doc - The doc used to create the cursor
   * @returns
   *
   * @public
   */
  public getDocCursor(doc: Document) {
    const { type, field } = this;
    const value = doc[field];
    if (type === 'Date') {
      const d = new Datte(value);
      // Return the unix millisecond timestamp
      return d.toString('x');
    }

    // Return the raw value
    return value;
  }

  /**
   * Get the paginator result
   *
   * @param docs - List of raw mongodb documents
   * @returns
   *
   * @public
   */
  public get(docs: Document[]) {
    const {
      hasNextPage, hasPreviousPage, totalPage, totalResults, currentPage,
    } = this;
    const edges: CursorEdge[] = [];
    docs.forEach((doc) => {
      edges.push({
        cursor: this.getDocCursor(doc),
        node: doc,
      });
    });
    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage,
        totalPage,
        totalResults,
        currentPage,
        startCursor: (docs.length !== 0 ? this.getDocCursor(docs[0]) : null),
        endCursor: (docs.length !== 0 ? this.getDocCursor(docs[(docs.length - 1)]) : null),
      },
    };
  }

  /**
   * Remove null step from the pipeline
   *
   * @param pipeline - The mongodb pipeline
   * @returns
   *
   * @internal
   */
  public static pipelineCleaner(pipeline: Pipeline) {
    return pipeline.filter((item) => {
      if (!item) {
        return null;
      }
      return item;
    });
  }

  /**
   * Generate the pipeline step to get the next wanted docs
   *
   * @param reverse - If you want to sort by desc
   * @returns
   *
   * @internal
   */
  protected makeMatcher(reverse: boolean) {
    const {
      field, value, order,
    } = this;

    if (!value) {
      return null;
    }

    const matcher: any = { $match: { [field]: {} } };
    if (order === 'ASC') {
      matcher.$match[field][(reverse ? '$lte' : '$gt')] = value;
    }
    if (order === 'DESC') {
      matcher.$match[field][(reverse ? '$gte' : '$lt')] = value;
    }
    return matcher;
  }

  /**
   * Get the pipeline to use for the aggregation
   *
   * @param pipeline - Custom pipeline used to match a sub-selection of docs
   * @param reverse - Set to true if you want to sort by desc
   * @returns
   *
   * @public
   */
  public getPipeline(customPipeline: Pipeline, reverse: boolean = false) {
    const { field, order, limit } = this;

    const filters = Helper.getFilterPipeline(this.filters);

    const filtersPipeline = [];
    if (filters) {
      filtersPipeline.push({ $match: filters });
    }

    return [
      ...filtersPipeline,
      ...customPipeline,
      { $sort: { [field]: (order === 'DESC' ? -1 : 1) } },
      {
        $facet: {
          cursored: Paginator.pipelineCleaner([
            this.makeMatcher(reverse),
            {
              $facet: {
                total: [
                  { $group: { _id: 1, counter: { $sum: 1 } } },
                ],
                current: [
                  { $limit: limit },
                ],
              },
            },
          ]),
          total: [
            { $group: { _id: 1, counter: { $sum: 1 } } },
          ],
        },
      },
    ];
  }
}

export default Paginator;
