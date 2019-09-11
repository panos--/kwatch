import * as blessed from "blessed";
import { K8sClient, APIResource } from "../client";
import { AppState } from "../app_state";
import { Action } from "../actions/action";
import { DescribeAction } from "../actions/describe_action";

export class ResourceActionMenu {
    private state: AppState;
    private client: K8sClient;
    private screen: blessed.Widgets.Screen;
    private contextMenu: blessed.Widgets.ListElement;
    private onAfterCloseCallback: () => void = null;

    public constructor(state: AppState, client: K8sClient) {
        this.state = state;
        this.client = client;
        this.init();
    }

    private init() {
        this.contextMenu = blessed.list({
            top: 15,
            left: 55,
            width: 40,
            height: 15,
            mouse: true,
            keys: true,
            border: "line",
            hidden: true,
            items: ["foo", "bar", "baz", "qux"],
            shrink: true,
            style: {
                item: {
                    hover: {
                        bg: "blue",
                        fg: "white",
                    }
                },
                selected: {
                    bg: "blue",
                    fg: "white",
                    bold: true
                }
            },
        });
        this.contextMenu.style.border.bg = 12;
        this.contextMenu.on("blur", () => {
            this.close();
        });
        this.contextMenu.on("cancel", () => {
            this.close();
        });
        this.contextMenu.on("select", (item, index) => {
            this.close();
            this.executeContextMenuAction(index);
        });

        this.initContextMenuActions();
    }

    public show(namespace: string, apiResource: APIResource, resource: string) {
        this.populateContextMenu(namespace, apiResource, resource);
        this.contextMenu.setIndex(100);
        this.contextMenu.show();
        this.contextMenu.focus();
        this.render();
    }

    private close() {
        this.contextMenu.hide();
        this.render();
        if (this.onAfterCloseCallback != null) {
            this.onAfterCloseCallback.call(null);
        }
    }

    public onAfterClose(callback: () => void) {
        this.onAfterCloseCallback = callback;
    }

    private contextMenuActions: Action[];
    private activeContextMenuActions: (() => void)[];

    private initContextMenuActions() {
        this.contextMenuActions = [
            new DescribeAction(),
        ];
    }
    private populateContextMenu(namespaceName: string, apiResource: APIResource, resource: string) {
        const namespace = this.state.namespaces.find((element) => {
            return element.metadata.name == namespaceName;
        });
        if (!namespace) {
            throw "namespace not found";
        }
        this.contextMenu.clearItems();
        this.activeContextMenuActions = [];
        this.contextMenuActions
            .filter((action) => { return action.appliesTo(apiResource); })
            .forEach((action) => {
                this.activeContextMenuActions.push(() => {
                    action.execute(this.client, this.screen, namespace, apiResource, resource);
                });
                this.contextMenu.addItem(action.getLabel());
            });
    }

    private executeContextMenuAction(index: number) {
        this.activeContextMenuActions[index]();
    }

    public appendTo(box: blessed.Widgets.BoxElement) {
        box.append(this.contextMenu);
        this.screen = this.contextMenu.screen;
    }

    private render() {
        if (this.screen !== null) {
            this.screen.render();
        }
    }
}