class PaintBoardMenuBtn {
    name?: string;
    type?: string;
    onClick?: () => void;
    onChange?: () => void;
    active?: boolean;
    value?: string | number;

    constructor(
        name?: string,
        type?: string,
        onClick?: () => void,
        onChange?: () => void,
        active?: boolean,
        value?: string | number
    ) {
        this.name = name;
        this.type = type;
        this.onClick = onClick;
        this.onChange = onChange;
        this.active = active;
        this.value = value;
    }
}

interface PaintBoardMenuBtnBuilder {
    setName(name: string): this;
    setType(type: string): this;
    setOnClick(onClick: () => void): this;
    setOnChange(onChange: () => void): this;
    setActive(active: boolean): this;
    setValue(value: string | number): this;
    build(): PaintBoardMenuBtn;
}

class ChromePaintBoardMenuBtnBuilder implements PaintBoardMenuBtnBuilder {
    btn: PaintBoardMenuBtn;
    constructor() {
        this.btn = new PaintBoardMenuBtn();
    }

    setName(name: string) {
        this.btn.name = name;
        return this;
    }
    setType(type: string) {
        this.btn.type = type;
        return this;
    }
    setOnClick(onClick: () => void) {
        this.btn.onClick = onClick;
        return this;
    }
    setOnChange(onChange: () => void) {
        this.btn.onChange = onChange;
        return this;
    }
    setActive(active: boolean) {
        this.btn.active = active;
        return this;
    }
    setValue(value: string | number) {
        this.btn.value = value;
        return this;
    }
    build() {
        return this.btn;
    }
}

class IEPaintBoardMenuBtnBuilder implements PaintBoardMenuBtnBuilder {
    btn: PaintBoardMenuBtn;
    constructor() {
        this.btn = new PaintBoardMenuBtn();
    }
    setName(name: string) {
        this.btn.name = name;
        return this;
    }
    setType(type: string) {
        this.btn.type = type;
        return this;
    }
    setOnClick(onClick: () => void) {
        this.btn.onClick = onClick;
        return this;
    }
    setOnChange(onChange: () => void) {
        this.btn.onChange = onChange;
        return this;
    }
    setActive(active: boolean) {
        this.btn.active = active;
        return this;
    }
    setValue(value: string | number) {
        this.btn.value = value;
        return this;
    }
    build() {
        return this.btn;
    }
}

export class PaintBoardMenuBtnDirector {
    static createBackBtn(builder: PaintBoardMenuBtnBuilder) {
        const backBtnBuilder = builder
            .setName("뒤로")
            .setType("back")
            .setOnClick(() => {})
            .setActive(false);
        return backBtnBuilder;
    }
    static createForwardBtn(builder: PaintBoardMenuBtnBuilder) {
        const forwardBtnBuilder = builder
            .setName("앞으로")
            .setType("forward")
            .setOnClick(() => {})
            .setActive(false);
        return forwardBtnBuilder;
    }
}

PaintBoardMenuBtnDirector.createBackBtn(new ChromePaintBoardMenuBtnBuilder());
PaintBoardMenuBtnDirector.createForwardBtn(new IEPaintBoardMenuBtnBuilder());
