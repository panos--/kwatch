import * as blessed from "blessed";
import { APIResource } from "../client";
import { Action } from "../actions/action";
import { DescribeAction } from "../actions/describe_action";
import { V1Namespace } from "@kubernetes/client-node";
import { ShowYamlAction } from "../actions/show_yaml_action";
import { DeleteAction } from "../actions/delete_action";
import { ExecLoginBashAction } from "../actions/exec_login_bash_action";
import { ExecShellAction } from "../actions/exec_shell_action";
import { ExecLoginShellAction } from "../actions/exec_login_shell_action";
import { ExecBashAction } from "../actions/exec_bash_action";
import { ExecCommandAction } from "../actions/exec_command_action";
import { ViewLogAction } from "../actions/view_log_action";
import { TailLogAction } from "../actions/tail_log_action";
import { ShowSecretsAction } from "../actions/show_secrets_action";
import { DumpSecretsAction } from "../actions/dump_secrets_action";
import { ForceDeleteAction } from "../actions/force_delete_action";
import { AppContext } from "../app_context";

export class ResourceActionMenu {
    private static readonly LABEL = "Choose Action";

    private ctx: AppContext;
    private parent: blessed.Widgets.Node;
    private contextMenu: blessed.Widgets.ListElement;
    private onAfterCloseCallback: () => void = null;

    public constructor(ctx: AppContext, parent: blessed.Widgets.Node) {
        this.ctx = ctx;
        this.parent = parent;
        this.init();
    }

    private init() {
        this.contextMenu = blessed.list({
            parent: this.parent,
            label: ResourceActionMenu.LABEL,
            top: "center",
            left: "center",
            width: 40,
            height: 15,
            mouse: true,
            keys: true,
            border: "line",
            hidden: true,
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
        this.contextMenu.style.border.bg = this.ctx.colorScheme.COLOR_BORDER_BG_FOCUS;
        this.contextMenu.on("blur", () => {
            this.close();
        });
        this.contextMenu.on("cancel", () => {
            this.close();
        });
        let keyPressLocked = false;
        this.contextMenu.on("keypress", (ch) => {
            if (!/^\d$/.test(ch)) {
                return;
            }

            if (keyPressLocked) {
                return;
            }
            keyPressLocked = true;

            let num = parseInt(ch);
            if (num == 0) {
                num = 10;
            }
            num--;
            if (num < this.activeContextMenuActions.length) {
                this.contextMenu.select(num);
                this.ctx.screen.render();
                setTimeout(() => {
                    this.close();
                    this.executeContextMenuAction(num);
                    keyPressLocked = false;
                }, 100);
            }

            keyPressLocked = false;
        });
        this.contextMenu.on("select", (item, index) => {
            this.close();
            this.executeContextMenuAction(index);
        });

        this.initContextMenuActions();
    }

    public show(namespace: V1Namespace, apiResource: APIResource, resource: string) {
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
            new ShowYamlAction(),
            new ShowSecretsAction(),
            new DumpSecretsAction(),
            new ExecBashAction(),
            new ExecLoginBashAction(),
            new ExecShellAction(),
            new ExecLoginShellAction(),
            new ExecCommandAction(),
            new ViewLogAction(),
            new TailLogAction(),
            new DeleteAction(),
            new ForceDeleteAction(),
        ];
    }

    private populateContextMenu(namespace: V1Namespace, apiResource: APIResource, resource: string) {
        this.contextMenu.clearItems();
        this.activeContextMenuActions = [];
        let actions = this.contextMenuActions.filter((action) => { return action.appliesTo(apiResource); });
        actions.forEach((action, index) => {
            this.activeContextMenuActions.push(() => {
                action.execute(this.ctx, namespace, apiResource, resource);
            });
            let itemKey = index + 1;
            this.contextMenu.addItem(`${itemKey < 10 ? itemKey : (itemKey > 10 ? " " : 0)} ${action.getLabel()}`);
        });
        const lengths = actions.map(action => { return action.getLabel().length; });
        let maxLength = Math.max.apply(null, lengths);
        const label = ResourceActionMenu.LABEL;
        this.contextMenu.width = Math.min(Math.max(maxLength, label.length + 4) + 2, 50);
        this.contextMenu.height = Math.min(actions.length + 2, 20);
    }

    private executeContextMenuAction(index: number) {
        this.activeContextMenuActions[index]();
    }

    private render() {
        if (this.ctx.screen !== null) {
            this.ctx.screen.render();
        }
    }
}
