/*
 * Module introducing an indirection to allow jest-mocking of classes
 * without mocking entities (such as V1APIResource, etc.).
 * Necessary since mocking of entities breaks deserialization of JSON data
 * into entity instances.
 */

export { KubeConfig, CoreV1Api, ApisApi } from "@kubernetes/client-node";
