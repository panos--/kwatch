import { AppContext } from "../app_context";
import { OptionList } from "./select_list_widget";
import { V1Namespace } from "@kubernetes/client-node";
import { DrilldownWidget } from "./drilldown_widget";

export class NamespaceListWidget {
    private ctx: AppContext;
    private list: DrilldownWidget<V1Namespace>;

    public constructor(ctx: AppContext) {
        this.ctx = ctx;
        this.init();
    }

    private init() {
        const optionList: OptionList<V1Namespace> = new OptionList();
        for (let namespace of this.ctx.state.namespaces) {
            optionList.addOption({ label: namespace.metadata.name, value: namespace });
        }
        const maxLength = Math.max.apply(null, this.ctx.state.namespaces.map(n => n.metadata.name.length));
        const screenWidth: any = this.ctx.screen.width;
        this.list = new DrilldownWidget<V1Namespace>(this.ctx, optionList, {
            parent: this.ctx.screen,
            label: "Choose Namespace",
            width: Math.max(20, Math.min(maxLength + 3, screenWidth - 10)),
            closeOnSubmit: true,
        });
        this.list.onSubmit((namespace: V1Namespace) => {
            this.ctx.state.namespace = namespace;
        });
        this.list.onBlur(() => { this.destroy(); });
    }

    public onSelect(callback: (namespace: V1Namespace) => void) {
        this.list.onSubmit(callback);
    }

    public onClose(callback: () => void) {
        this.list.onBlur(callback);
    }

    public focus() {
        this.list.focus();
    }

    private destroy() {
        this.list.destroy();
    }
}
