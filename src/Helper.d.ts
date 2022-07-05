export type MatchFilter = {
  operator: ('STRICT_WORD' | 'CONTAINS_WORD' | 'CONTAINS_PART')
  value: (string | number)
}

// TODO: Handle undefined withDeleted into [key] field
export interface IFilterPipelineInput {
  [key: string]: (string | string[] | boolean | MatchFilter | undefined)
  withDeleted?: boolean
}

export interface IFiltersPipeline {
  $and: ({
    [key: string]: unknown
    deletedAt?: null
  })[]
}
