#!/bin/bash

echo "🚀 Deploying RPS Battle Arena..."

# Install Lambda dependencies
echo "📦 Installing Lambda dependencies..."
cd src
npm install
cd ..

# Build and deploy CDK
echo "🏗️ Building and deploying infrastructure..."
cd infrastructure
mvn package
npx cdk deploy --require-approval never

echo "✅ Deployment complete!"
echo "📋 Check the outputs above for API URLs and other resources."
echo "📁 To deploy frontend, upload files from 'frontend/' directory to the S3 bucket shown above."