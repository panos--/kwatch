import * as k8sClient from "../lib/client";

const client = new k8sClient.K8sClient();

// client.getAPIResources(resources => {
//     for (let resource of resources) {
//         console.log(resource.getName());
//     }
// });

//client.listResourcesFormatted("system", ["pods", "deployments"], (resources) => {
//    for (let resource of resources) {
//        console.log(resource);
//    }
//});
