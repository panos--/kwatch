import * as blessed from "blessed";
import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource, K8sClient } from "../client";

export class ShowYamlAction implements Action {
    public getLabel() {
        return "Show YAML";
    }

    public appliesTo(): boolean {
        return true;
    }

    public execute(client: K8sClient, screen: blessed.Widgets.Screen, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        client.getResourceAsYaml(namespace, apiResource, resource, (error, lines) => {
            let box = blessed.box({
                top: 3,
                left: 5,
                height: "100%-6",
                width: "100%-10",
                mouse: true,
                keys: true,
                border: "line",
                scrollable: true,
                alwaysScroll: true,
                scrollbar:  {
                    ch: " ",
                    track: {
                        bg: "cyan"
                    },
                    style: {
                        inverse: true
                    }
                },
            });
            box.setIndex(100);
            box.setLabel(
                (apiResource.resource.namespaced ? namespace.metadata.name + " / " : "")
                + apiResource.getCapitalizedSingularName() + " " + resource);
            box.key("pageup", () => {
                box.scroll(-(box.height / 2 | 0) || -1);
            });
            box.key("pagedown", () => {
                box.scroll(box.height / 2 | 0 || 1 );
            });
            box.key("escape", () => {
                box.destroy();
                screen.render();
            });
            screen.append(box);

            if (error) {
                console.log(error.message);
                return;
            }
            else {
                box.insertBottom(lines);
            }

            box.focus();
            screen.render();
        });
    }
}
