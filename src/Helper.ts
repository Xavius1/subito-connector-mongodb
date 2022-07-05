import mongo from 'mongodb';
import type { IFilterPipelineInput, IFiltersPipeline } from './Helper.d';

/**
 * MongoDB helper that can be usefull for some stuff.
 * @public
 */
class Helper {
  /**
   * Create a new mongo ID
   *
   * @param toString - Instead of create a mongo.ObjectId(), set to true to receive a string ID
   * @returns
   *
   * @public
   */
  static newMongoId(toString: boolean) {
    const id = new mongo.ObjectId();

    if (toString) {
      return id.toString();
    }

    return id;
  }

  /**
   * Get a pipeline matching your filters
   *
   * @param filters - Filters you want apply into the pipeline
   * @returns
   *
   * @public
   */
  static getFilterPipeline(filters: IFilterPipelineInput) {
    const matcher: IFiltersPipeline = { $and: [] };

    if (!filters?.withDeleted) {
      matcher.$and.push({ deletedAt: null });
    }

    if (filters) {
      Object.keys(filters).forEach((field: string) => {
        if (field !== 'withDeleted') {
          if (typeof filters[field] === 'string') {
            matcher.$and.push({ [field]: filters[field] });
          // @ts-ignore TODO Handle ts error
          } else if (Array.isArray(filters[field]) && typeof filters[field]?.[0] === 'string') {
            matcher.$and.push({ [field]: { $in: filters[field] } });
          } else {
            // @ts-ignore TODO Handle ts error
            const { operator, value } = filters[field];
            let r = null;
            switch (operator) {
              case 'STRICT_WORD':
                matcher.$and.push({ [field]: value });
                break;
              case 'CONTAINS_WORD':
                r = new RegExp(`${value}`, 'b');
                matcher.$and.push({ [field]: { $regex: r, $options: 'i' } });
                break;
              case 'CONTAINS_PART':
                r = new RegExp(`${value}`);
                matcher.$and.push({ [field]: { $regex: r, $options: 'i' } });
                break;
              default:
            }
          }
        }
      });
    }

    if (matcher.$and.length > 0) {
      return matcher;
    }
    return null;
  }
}

export default Helper;
