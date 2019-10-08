import _ from "lodash";
import { V1APIGroup, V1APIResource } from "@kubernetes/client-node";
import pluralize from "pluralize";

export class APIResource {
    public group?: V1APIGroup;
    public groupVersion: string;
    public resource: V1APIResource;

    public constructor(resource: V1APIResource, groupVersion: string, group?: V1APIGroup) {
        this.resource = resource;
        this.group = group;
        this.groupVersion = groupVersion;
    }

    public getName() {
        return this.resource.name;
    }

    public getCapitalizedName() {
        return _.capitalize(this.resource.name);
    }

    public getLongName() {
        let name = this.resource.name;
        if (this.group) {
            name += "." + this.group.name;
        }
        return name;
    }

    public getFullName() {
        return this.getLongName() + "/" + this.groupVersion;
    }

    public getSingularName() {
        if (this.resource.singularName.length > 0) {
            return this.resource.singularName;
        }
        return pluralize.singular(this.resource.name);
    }

    public getCapitalizedSingularName() {
        return _.capitalize(this.getSingularName());
    }

    public isCustomResource(): boolean {
        if (!this.group) {
            return false;
        }
        if (!this.group.name.includes(".")) {
            return false;
        }
        if (this.group.name.endsWith(".k8s.io")) {
            return false;
        }
        return true;
    }
}
