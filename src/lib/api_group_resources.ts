import { V1APIGroup, V1APIResource } from "@kubernetes/client-node";
import { VersionedAPIResource } from "./versioned_api_resource";
import { K8sUtils } from "./k8s_utils";

export class APIGroupResources {
    public group: V1APIGroup;
    private resources: {
        [index: string]: VersionedAPIResource[];
    };

    public constructor(group: V1APIGroup) {
        this.group = group;
        this.resources = {};
    }

    public addResource(resource: V1APIResource, groupVersion: string) {
        if (!this.resources.hasOwnProperty(resource.name)) {
            this.resources[resource.name] = [];
        }
        this.resources[resource.name].push(new VersionedAPIResource(resource, groupVersion));
    }

    public getNewestResources(): VersionedAPIResource[] {
        let result: VersionedAPIResource[] = [];
        for (let versionedResources of Object.values(this.resources)) {
            let newestResource = versionedResources.sort((a, b): number => {
                return K8sUtils.compareAPIVersion(a.groupVersion, b.groupVersion);
            }).pop();
            result.push(newestResource);
        }
        return result;
    }
}
