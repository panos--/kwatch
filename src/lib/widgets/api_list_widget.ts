import { Widgets } from "blessed";
import { AppContext } from "../app_context";
import { DrilldownWidget } from "./drilldown_widget";
import { APIResource } from "../client";
import { OptionList } from "./select_list_widget";

interface ResourceCategory {
    group: string|RegExp;
    name: string|RegExp;
    category: string;
}

export class APIListWidget {
    private ctx: AppContext;
    private drilldown: DrilldownWidget<APIResource>;

    private readonly resourceCategories: ResourceCategory[] = [
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
        {
            group: "autoscaling",
            name: "horizontalpodautoscalers",
            category: "Cluster"
        },
        {
            group: "apiregistration.k8s.io",
            name: "apiservices",
            category: "Cluster"
        },
        {
            group: "events.k8s.io",
            name: "events",
            category: "Cluster"
        },
        {
            group: "scheduling.k8s.io",
            name: "priorityclasses",
            category: "Cluster"
        },
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
            group: /^.*\.k8s\.io|[^\.]+$/,
            name: /.*/,
            category: "Other"
        },
        {
            group: /.*/,
            name: /.*/,
            category: "Custom"
        }
    ];

    public constructor(ctx: AppContext, parent: Widgets.Node) {
        this.ctx = ctx;
        this.init(parent);
    }

    private init(parent: Widgets.Node) {
        this.drilldown = new DrilldownWidget(this.ctx, new OptionList(), {
            label: "API Resources",
            parent: parent,
            top: 0,
            left: 0,
            width: "100%",
            height: "100%-1",
            closeOnSubmit: false,
        });
    }

    public async updateApiList(doneCb?: () => void) {
        this.ctx.client.getListableAPIResources((error, resources) => {
            if (error) {
                console.log(error);
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

            const categorizedResources = this.categorizeResources(resources);
            const categories = [
                "Cluster",
                "Workloads",
                "Config",
                "Network",
                "Storage",
                "Security",
                "Custom",
                "Other",
            ];
            for (let category of Object.keys(categorizedResources)) {
                if (!categories.includes(category)) {
                    categories.push(category);
                }
            }
            const listOptions = new OptionList<APIResource>();
            for (let category of categories) {
                const options = [];
                for (let resource of categorizedResources[category]) {
                    options.push({
                        label: resource.getLongName(),
                        value: resource,
                    });
                }
                listOptions.addGroup({
                    label: category,
                    options: options,
                });
            }
            this.drilldown.setValues(listOptions);

            if (this.ctx.state.apiResource === null) {
                this.ctx.state.apiResource = this.drilldown.getSelectedValue();
            }
            else {
                this.drilldown.selectValue(this.ctx.state.apiResource);
            }

            this.ctx.screen.render();
            if (doneCb) {
                doneCb();
            }
        }).catch(e => {
            console.log(e);
        });
    }

    private categorizeResources(resources: APIResource[]) {
        const groupedResources: {[group: string]: APIResource[]} = {};
        for (let r of resources) {
            let category = this.categorizeResource(r);
            if (!(category in groupedResources)) {
                groupedResources[category] = [];
            }
            groupedResources[category].push(r);

            category = null;
        }
        return groupedResources;
    }

    private categorizeResource(resource: APIResource): string|null {
        let category = null;
        for (let matcher of this.resourceCategories) {
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

        if (category === null) {
            category = "Unknown";
        }

        return category;
    }

    public onSelect(callback: (value: APIResource) => void) {
        this.drilldown.onSelect(callback);
    }

    public key(name: string | string[], listener: (ch: any, key: Widgets.Events.IKeyEventArg) => void) {
        this.drilldown.key(name, listener);
    }
}
