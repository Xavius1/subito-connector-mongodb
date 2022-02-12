import mongo from 'mongodb';

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
   */
  static newMongoId(toString: boolean) {
    const id = new mongo.ObjectId();

    if (toString) {
      return id.toString();
    }

    return id;
  }
}

export default Helper;
