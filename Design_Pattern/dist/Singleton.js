const PAINTBOARD_SYMBOL = Symbol();
Symbol("abc") === Symbol("abc"); // False

class PaintBoard {
  static instance;
  constructor(canvas, symbol) {
    if (symbol === PAINTBOARD_SYMBOL) {
      throw new Error("new를 통해 호출할 수 없습니다.");
    }
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error("canvas 엘리먼트를 활용하세요");
    }
  }
  initialize() {}
  initializeMenu() {}
  static getInstance() {
    if (!this.instance) {
      this.instance = new PaintBoard(
        document.querySelector("canvas"),
        PAINTBOARD_SYMBOL
      );
    }
    return this.instance;
  }
}
export default PaintBoard;
