import { Widgets } from "blessed";
import { AppContext, AppState, AppViewContext } from "../app_context";
import { DrilldownWidget } from "./drilldown_widget";
import { K8sClient } from "../client";
import { APIResource } from "../api_resource";
import { OptionList } from "./select_list_widget";
import { K8sUtils } from "../k8s_utils";

interface ResourceCategoryMapping {
    group: string|RegExp;
    name: string|RegExp;
    category: string;
}

export interface ModelContext {
    state: AppState;
    client: K8sClient;
}

export class APIListHelper {
    private resourceCategories: string[];
    private resourceCategoryMappings: ResourceCategoryMapping[];

    public constructor(resourceCategories: string[], resourceCategoryMappings: ResourceCategoryMapping[]) {
        this.resourceCategories = resourceCategories;
        this.resourceCategoryMappings = resourceCategoryMappings;

        const mappingCategories = [...new Set(this.resourceCategoryMappings.map(cat => { return cat.category; }))];
        for (let category of mappingCategories) {
            if (!this.resourceCategories.includes(category)) {
                throw "internal error: unknown category specified in resource-category mapping: " + category;
            }
        }
    }

    public filterPreferredVersions(resources: APIResource[]) {
        let standardResources: {[key: string]: APIResource[]} = {};
        const customResources: APIResource[] = [];
        for (let resource of resources) {
            if (resource.isCustomResource()) {
                customResources.push(resource);
                continue;
            }

            if (!(resource.resource.name in standardResources)) {
                standardResources[resource.resource.name] = [];
            }
            standardResources[resource.resource.name].push(resource);
        }

        for (let resourceName of Object.keys(standardResources)) {
            standardResources[resourceName].sort((a, b) => {
                return K8sUtils.compareAPIVersion(a.groupVersion, b.groupVersion);
            });
        }

        const result: APIResource[] = [];
        for (let resourceName of Object.keys(standardResources)) {
            const candidates = standardResources[resourceName];
            result.push(candidates[candidates.length - 1]);
        }

        for (let customResource of customResources) {
            result.push(customResource);
        }

        return result;
    }

    public categorizeResources(resources: APIResource[]) {
        const groupedResources: {[group: string]: APIResource[]} = {};
        for (let r of resources) {
            let category = this.categorizeResource(r);
            if (category === null) {
                throw "internal error: not category found for api resource: " + r.getName();
            }
            if (!(category in groupedResources)) {
                groupedResources[category] = [];
            }
            groupedResources[category].push(r);

            category = null;
        }
        return groupedResources;
    }

    public categorizeResource(resource: APIResource): string|null {
        let category = null;
        for (let matcher of this.resourceCategoryMappings) {
            let groupMatched = false;
            const resourceGroupName = resource.group ? resource.group.name : "";
            if (typeof matcher.group == "string") {
                if (matcher.group == resourceGroupName) {
                    groupMatched = true;
                }
            }
            else if (matcher.group.test(resourceGroupName)) {
                groupMatched = true;
            }
            if (!groupMatched) {
                continue;
            }

            let nameMatched = false;
            if (typeof matcher.name == "string") {
                if (matcher.name == resource.resource.name) {
                    nameMatched = true;
                }
            }
            else if (matcher.name.test(resource.resource.name)) {
                nameMatched = true;
            }
            if (nameMatched) {
                category = matcher.category;
                break;
            }
        }

        return category;
    }

    public sortResources(resources: APIResource[]) {
        resources.sort((a, b) => {
            const aName = a.getLongName();
            const bName = b.getLongName();
            return aName.localeCompare(bName);
        });
    }

    public buildOptionList(categorizedResources: { [x: string]: APIResource[] }): OptionList<APIResource> {
        const listOptions = new OptionList<APIResource>();
        for (let category of this.resourceCategories) {
            if (!(category in categorizedResources)) {
                continue;
            }
            const options = [];
            this.sortResources(categorizedResources[category]);
            for (let resource of categorizedResources[category]) {
                options.push({
                    label: resource.isCustomResource() ? resource.getLongName() : resource.getName(),
                    value: resource,
                });
            }
            listOptions.addGroup({
                label: category,
                options: options,
            });
        }
        return listOptions;
    }
}

export class APIListModel {
    private readonly resourceCategories = [
        "Cluster",
        "Workloads",
        "Config",
        "Network",
        "Storage",
        "Security",
        "Certificates",
        "Other",
        "Custom",
    ];

    private readonly resourceCategoryMappings: ResourceCategoryMapping[] = [
        {
            group: "",
            name: /^componentstatuses|events|namespaces|nodes$/,
            category: "Cluster"
        },
        {
            group: "apps",
            name: "controllerrevisions",
            category: "Cluster"
        },
        // {
        //     group: "autoscaling",
        //     name: "horizontalpodautoscalers",
        //     category: "Cluster"
        // },
        // {
        //     group: "apiregistration.k8s.io",
        //     name: "apiservices",
        //     category: "Cluster"
        // },
        {
            group: "events.k8s.io",
            name: "events",
            category: "Cluster"
        },
        // {
        //     group: "scheduling.k8s.io",
        //     name: "priorityclasses",
        //     category: "Cluster"
        // },
        {
            group: "",
            name: /^configmaps|secrets$/,
            category: "Config"
        },
        {
            group: "",
            name: /^endpoints|services$/,
            category: "Network"
        },
        {
            group: "extensions",
            name: /^ingresses|networkpolicies$/,
            category: "Network"
        },
        {
            group: "networking.k8s.io",
            name:"networkpolicies",
            category: "Network"
        },
        {
            group: "",
            name: "serviceaccounts",
            category: "Security"
        },
        {
            group: "rbac.authorization.k8s.io",
            name: /^clusterrolebindings|clusterroles|rolebindings|roles$/,
            category: "Security"
        },
        {
            group: "",
            name: /^persistentvolumeclaims|persistentvolumes$/,
            category: "Storage"
        },
        {
            group: "storage.k8s.io",
            name: /^storageclasses|volumeattachments$/,
            category: "Storage"
        },
        {
            group: /^apps|extensions$/,
            name: /^daemonsets|deployments|replicasets$/,
            category: "Workloads"
        },
        {
            group: "apps",
            name: "statefulsets",
            category: "Workloads"
        },
        {
            group: "batch",
            name: /^cronjobs|jobs$/,
            category: "Workloads"
        },
        {
            group: "",
            name: "pods",
            category: "Workloads"
        },
        {
            group: /^(certmanager|certificates)\.k8s\.io$/,
            name: /.*/,
            category: "Certificates"
        },
        {
            group: /^.*\.k8s\.io$/,
            name: /.*/,
            category: "Other"
        },
        {
            group: /^[^\.]*$/,
            name: /.*/,
            category: "Other"
        },
        {
            group: /.*/,
            name: /.*/,
            category: "Custom"
        }
    ];

    private ctx: ModelContext;
    private helper: APIListHelper;

    private updateCallback: (options: OptionList<APIResource>, selectedValue: APIResource|null) => void;

    public constructor(ctx: ModelContext) {
        this.ctx = ctx;
        this.helper = new APIListHelper(this.resourceCategories, this.resourceCategoryMappings);
    }

    public onUpdate(callback: (options: OptionList<APIResource>, selectedValue: APIResource|null) => void) {
        this.updateCallback = callback;
    }

    private emitUpdate(options: OptionList<APIResource>, selectedValue: APIResource|null) {
        if (this.updateCallback) {
            this.updateCallback.call(null, options, selectedValue);
        }
    }

    public async updateApiList(callback?: (error?: string) => void) {
        this.ctx.client.getListableAPIResources((error, resources) => {
            if (error) {
                callback(
                    "Error loading api resources\n\n"
                    + `Reason: ${error.message}`);
                return;
            }

            // update state
            this.ctx.state.apiResources = resources;
            if (this.ctx.state.apiResource !== null) {
                // make sure object identity is given for apiResource object in state
                // and in apiList
                const r = resources.find(r => {
                    return this.ctx.state.apiResource.getFullName() == r.getFullName();
                });
                if (r !== undefined) {
                    this.ctx.state.apiResource = r;
                }
            }

            const filteredResources = this.helper.filterPreferredVersions(resources);
            const categorizedResources = this.helper.categorizeResources(filteredResources);
            const listOptions = this.helper.buildOptionList(categorizedResources);

            if (this.ctx.state.apiResource === null) {
                // "value" in option => value instanceof OptionItem
                const value = listOptions.toArray().find(option => { return "value" in option; });
                this.ctx.state.apiResource = value && "value" in value ? value.value : null;
            }

            this.emitUpdate(listOptions, this.ctx.state.apiResource);

            if (callback) {
                callback();
            }
        });
    }
}

class APIListView {
    private ctx: AppViewContext;
    private drilldown: DrilldownWidget<APIResource>;

    public constructor(ctx: AppContext, parent: Widgets.Node) {
        this.ctx = ctx;
        this.drilldown = new DrilldownWidget(ctx, new OptionList(), {
            label: "API Resources",
            parent: parent,
            top: 0,
            left: 0,
            width: "100%",
            height: "100%-1",
        });
    }

    public update(listOptions: OptionList<APIResource>, selectedValue: APIResource) {
        this.drilldown.setValues(listOptions);
        this.drilldown.selectValue(selectedValue);
        this.ctx.screen.render();
    }

    public showError(message: string) {
        this.ctx.widgetFactory.error(message);
    }

    public onSelect(callback: (value: APIResource) => void) {
        this.drilldown.onSubmit(callback);
    }

    public key(name: string | string[], listener: (ch: any, key: Widgets.Events.IKeyEventArg) => void) {
        this.drilldown.key(name, listener);
    }
}

export class APIListWidget {
    private view: APIListView;
    private model: APIListModel;

    public constructor(ctx: AppContext, parent: Widgets.Node) {
        this.view = new APIListView(ctx, parent);
        this.model = new APIListModel(ctx);
        this.init();
    }

    private init() {
        this.model.onUpdate((options, selectedValue) => {
            this.view.update(options, selectedValue);
        });
    }

    public async updateApiList(doneCb?: () => void) {
        this.model.updateApiList((error?) => {
            if (error) {
                this.view.showError(error);
                return;
            }
            if (doneCb) {
                doneCb();
            }
        });
    }

    public onSelect(callback: (value: APIResource) => void) {
        this.view.onSelect(callback);
    }

    public key(name: string | string[], listener: (ch: any, key: Widgets.Events.IKeyEventArg) => void) {
        this.view.key(name, listener);
    }
}
