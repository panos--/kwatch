export interface ColorScheme {
    COLOR_BG: number;
    COLOR_FG: number;
    COLOR_BORDER_BG_FOCUS: number;
    COLOR_BORDER_BG: number;
    COLOR_SCROLLBAR_BG: number;
    COLOR_INPUT_BG: number;
    COLOR_INPUT_BG_ERROR: number;
    COLOR_INPUT_FG: number;
    COLOR_BUTTON_BG: number;
    COLOR_BUTTON_FG: number;
}

export class LightColorScheme implements ColorScheme {
    public readonly COLOR_BG = 6;
    public readonly COLOR_FG = 15;
    public readonly COLOR_BORDER_BG_FOCUS = 12;
    public readonly COLOR_BORDER_BG = 7;
    public readonly COLOR_SCROLLBAR_BG = 7;
    public readonly COLOR_INPUT_BG = 6;
    public readonly COLOR_INPUT_BG_ERROR = 9;
    public readonly COLOR_INPUT_FG = 15;
    public readonly COLOR_BUTTON_BG = 4;
    public readonly COLOR_BUTTON_FG = 15;
}

export class DarkColorScheme implements ColorScheme {
    public readonly COLOR_BG = 6;
    public readonly COLOR_FG = 15;
    public readonly COLOR_BORDER_BG_FOCUS = 5;
    public readonly COLOR_BORDER_BG = 8;
    public readonly COLOR_SCROLLBAR_BG = 0;
    public readonly COLOR_INPUT_BG = 6;
    public readonly COLOR_INPUT_BG_ERROR = 9;
    public readonly COLOR_INPUT_FG = 15;
    public readonly COLOR_BUTTON_BG = 4;
    public readonly COLOR_BUTTON_FG = 15;
}
