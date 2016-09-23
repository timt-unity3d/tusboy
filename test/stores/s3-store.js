/* eslint-disable no-console*/
import aws from 'aws-sdk'
// import test from 'blue-tape'
import initS3Store from 's3-tus-store'

const {
  accessKeyId = 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  // docker-machine ip default
  endpoint = 'http://127.0.0.1:9000',
  bucket = 's3-tus-store',
} = {
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  endpoint: process.env.S3_ENDPOINT,
  bucket: process.env.S3_BUCKET,
}

const client = new aws.S3({
  accessKeyId,
  secretAccessKey,
  endpoint: new aws.Endpoint(endpoint),
  s3ForcePathStyle: true, // needed for minio
  signatureVersion: 'v4',
  s3DisableBodySigning: true,
})

// hmmmm, tmp workaround for https://github.com/aws/aws-sdk-js/issues/965#issuecomment-247930423
client.shouldDisableBodySigning = () => true

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

const Bucket = bucket

const clearBucket = async () => {
  console.log('      => clear bucket')
  const { Contents } = await client.listObjects({ Bucket })
    .promise()
  console.log('      => Contents')
  console.log(Contents)
  const tasks = Contents.map(({ Key }) => {
    console.log('      => deletObject')
    console.log(`      => ${Key} ${Bucket}`)
    return client.deleteObject({ Key, Bucket }).promise()
  })
  console.log('      => Promise.all(tasks)')
  return await Promise.all(tasks)
}

const createBucket = async (attempts = 0) => {
  console.log(`      => create bucket attempt ${attempts}`)
  try {
    console.log('      => clear bucket')
    await clearBucket()
    console.log('      => delete bucket')
    await client.deleteBucket({ Bucket }).promise()
  } catch (err) {
    // ignore NoSuchBucket errors
    console.log('      => error')
    console.log(err)
    if (err.code !== 'NoSuchBucket') {
      if (attempts === 3) {
        throw err
      }
      // hmmmm maybe we're doing this too quickly
      // exp backoff
      console.log(`      => wait ${500 * (2 ** attempts)}`)
      await wait(500 * (2 ** attempts))
      return createBucket(attempts + 1)
    }
  }
  console.log('      => client.createbucket')
  await client.createBucket({ Bucket }).promise()
}

const setup = async () => {
  console.log('      => setup')
  await createBucket()
  return initS3Store({ client, bucket })
}

/*
const teardown = async () => {
  await clearBucket()
  return client.deleteBucket({ Bucket }).promise()
}
*/

export default setup