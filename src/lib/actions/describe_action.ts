import * as blessed from "blessed";
import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource, K8sClient } from "../client";

export class DescribeAction implements Action {
    public getLabel() {
        return "Describe";
    }

    public appliesTo(apiResource: APIResource): boolean {
        return true;
    }

    public execute(client: K8sClient, screen: blessed.Widgets.Screen, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        // console.log(`would describe ${namespace}, ${apiResource.getName()}/${resource}`);
        client.describeResource(namespace, apiResource, resource, (error, lines) => {
            let box = blessed.box({
                top: 3,
                left: 5,
                height: "100%-6",
                width: "100%-10",
                mouse: true,
                keys: true,
                border: "line",
                scrollable: true,
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
            box.key("escape", () => {
                box.destroy();
                screen.render();
            });
            box.setIndex(100);
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
