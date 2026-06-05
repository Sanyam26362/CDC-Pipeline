import dotenv from 'dotenv'

dotenv.config()


export const getReplicationConfig = () => {
  return {
    connectionString: process.env.DATABASE_URL,
    replication: 'database',
  }
}

export const SLOT_NAME = process.env.REPLICATION_SLOT_NAME || 'cdc_pipeline_slot'
export const PLUGIN_NAME = 'wal2json'  