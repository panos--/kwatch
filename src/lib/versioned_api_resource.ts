import { V1APIResource } from "@kubernetes/client-node";

export class VersionedAPIResource {
    public resource: V1APIResource;
    public groupVersion: string;

    public constructor(resource: V1APIResource, groupVersion: string) {
        this.resource = resource;
        this.groupVersion = groupVersion;
    }
}
