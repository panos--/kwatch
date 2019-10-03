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
import { DrilldownWidget } from "./drilldown_widget";
import { OptionList } from "./select_list_widget";
import { LooseMatcherBuilder } from "../search/loose_matcher";

interface FixedAction {
    namespace: V1Namespace;
    apiResource: APIResource;
    resource: string;
    action: Action;
}

export class ResourceActionMenu {
    private static readonly LABEL = "Choose Action";

    private ctx: AppContext;
    private parent: blessed.Widgets.Node;
    private contextMenu: DrilldownWidget<FixedAction>;
    private contextMenuActions: Action[];
    private onAfterCloseCallback: () => void = null;
    private closed: boolean = true;

    public constructor(ctx: AppContext, parent: blessed.Widgets.Node) {
        this.ctx = ctx;
        this.parent = parent;
        this.init();
    }

    private init() {
        this.contextMenu = new DrilldownWidget<FixedAction>(this.ctx, new OptionList<FixedAction>(), {
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
        this.contextMenu.setMatcherBuilder(new LooseMatcherBuilder({
            caseInsensitive: true
        }));
        this.contextMenu.onBlur(() => {
            this.close();
        });
        // TODO: support "cancel" event in drilldown widget
        this.contextMenu.key("escape", () => {
            this.close();
        });
        this.contextMenu.onSubmit(() => {
            this.close();
            this.executeContextMenuAction(this.contextMenu.getSelectedValue());
        });

        this.initContextMenuActions();
    }

    public show(namespace: V1Namespace, apiResource: APIResource, resource: string) {
        if (!this.closed) {
            return;
        }
        this.closed = false;
        this.populateContextMenu(namespace, apiResource, resource);
        this.contextMenu.show();
        this.contextMenu.focus();
        this.render();
    }

    private close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.contextMenu.searchValue = "";
        this.contextMenu.hide();
        this.render();
        if (this.onAfterCloseCallback != null) {
            this.onAfterCloseCallback.call(null);
        }
    }

    public onAfterClose(callback: () => void) {
        this.onAfterCloseCallback = callback;
    }

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
        const optionList = new OptionList<FixedAction>();
        let actions = this.contextMenuActions.filter((action) => { return action.appliesTo(apiResource); });
        for (let action of actions) {
            optionList.addOption({
                label: action.getLabel(),
                value: {
                    namespace: namespace,
                    apiResource: apiResource,
                    resource: resource,
                    action: action,
                }});
        }
        this.contextMenu.setValues(optionList);
        const lengths = actions.map(action => { return action.getLabel().length; });
        let maxLength = Math.max.apply(null, lengths);
        const label = ResourceActionMenu.LABEL;
        this.contextMenu.width = Math.min(Math.max(maxLength, label.length + 4) + 2, 50);
        this.contextMenu.height = Math.min(actions.length + 5, 20);
    }

    private executeContextMenuAction(fixedAction: FixedAction) {
        fixedAction.action.execute(this.ctx, fixedAction.namespace, fixedAction.apiResource, fixedAction.resource);
    }

    private render() {
        if (this.ctx.screen !== null) {
            this.ctx.screen.render();
        }
    }
}
