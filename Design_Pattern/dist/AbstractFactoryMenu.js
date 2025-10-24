import { PaintBoardMenuBtn, PaintBoardMenuInput } from "./BuilderMenuBtn.js";
export class PaintBoardMenu {
    paintboard;
    dom;
    constructor(paintboard, dom) {
        this.paintboard = paintboard;
        this.dom = dom;
    }
    static getInstance(paintboard, dom) { }
}
export class IEPaintBoardMenu extends PaintBoardMenu {
    static instance;
    initialize(types) { }
    static getInstance(paintboard, dom) {
        if (!this.instance) {
            this.instance = new IEPaintBoardMenu(paintboard, dom);
        }
        return this.instance;
    }
}
export class ChromePaintBoardMenu extends PaintBoardMenu {
    static instance;
    initialize(types) {
        types.forEach(this.drawButtonByType.bind(this));
    }
    drawButtonByType(type) {
        switch (type) {
            case "back": {
                const btn = new PaintBoardMenuBtn.Builder(this, "뒤로").build();
                btn.draw();
                return btn;
            }
            case "forward": {
                const btn = new PaintBoardMenuBtn.Builder(this, "앞으로").build();
                btn.draw();
                return btn;
            }
            case "color": {
                const btn = new PaintBoardMenuInput.Builder(this, "컬러").build();
                btn.draw();
                return btn;
            }
            case "pipette": {
                const btn = new PaintBoardMenuBtn.Builder(this, "스포이드").build();
                btn.draw();
                return btn;
            }
            case "eraser": {
                const btn = new PaintBoardMenuBtn.Builder(this, "지우개").build();
                btn.draw();
                return btn;
            }
            case "pen": {
                const btn = new PaintBoardMenuBtn.Builder(this, "펜").build();
                btn.draw();
                return btn;
            }
            case "circle": {
                const btn = new PaintBoardMenuBtn.Builder(this, "원").build();
                btn.draw();
                return btn;
            }
            case "rectangle": {
                const btn = new PaintBoardMenuBtn.Builder(this, "사각형").build();
                btn.draw();
                return btn;
            }
            case "save": {
                const btn = new PaintBoardMenuBtn.Builder(this, "저장").build();
                btn.draw();
                return btn;
            }
            default:
                throw new Error(`알 수 없는 타입 ${type}`);
        }
    }
    static getInstance(paintboard, dom) {
        if (!this.instance) {
            this.instance = new ChromePaintBoardMenu(paintboard, dom);
        }
        return this.instance;
    }
}
