import { V1Namespace } from "@kubernetes/client-node";
import * as k8sClient from "./client";

export interface AppState {
    namespace: V1Namespace;
    namespaces: V1Namespace[];
    apiResource: k8sClient.APIResource;
    apiResources: k8sClient.APIResource[];
}
