#!/bin/bash

set -e
set -x

mkdir -p build/cpp build/go build/js build/python build/eams build/docs

protobuf/bin/protoc --experimental_allow_proto3_optional \
   --cpp_out=build/cpp/ \
   --go_out=build/go/ \
   --js_out=library=koinos_proto,one_output_file_per_input_file,binary:build/js \
   --python_out=build/python \
   --descriptor_set_out=build/koinos_descriptors.pb \
   `find koinos -name '*.proto'`

protobuf/bin/protoc --experimental_allow_proto3_optional --doc_out=build/docs --doc_opt=markdown,api.md `find koinos -name '*rpc*.proto'`

pushd EmbeddedProto

../protobuf/bin/protoc --experimental_allow_proto3_optional \
   --plugin=protoc-gen-eams \
   --eams_out=../build/eams \
   -I.. \
   `find ../koinos -name '*.proto'`

popd
