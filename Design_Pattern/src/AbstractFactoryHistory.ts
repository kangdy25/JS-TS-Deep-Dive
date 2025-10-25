import PaintBoard from "./PaintBoard_with_Browser/PaintBoardBase.js";
import ChromePaintBoard from "./PaintBoard_with_Browser/ChromePaintBoard.js";
import IEPaintBoard from "./PaintBoard_with_Browser/IEPaintBoard.js";

// -----------------------------
// 📘 Prototype 패턴 구현
// -----------------------------

// 복제 가능한 객체를 정의하는 인터페이스
interface Clonable {
  clone(): Clonable;
}

class HistroyStack extends Array implements Clonable {
  clone() {
    // slice()를 사용해 현재 배열의 얕은 복제본을 반환
    return this.slice() as HistroyStack;
  }
}

export abstract class PaintBoardHistory {
  paintboard: PaintBoard;
  stack: HistroyStack;

  // 현재 스택을 복제해서 외부로 반환 (원본 보호)
  getStack() {
    return this.stack.clone();
  }

  protected constructor(paintboard: PaintBoard) {
    this.paintboard = paintboard;
    this.stack = new HistroyStack();
  }

  // 외부에서 받은 스택을 복제하여 내부에 저장 (참조 공유 방지)
  setStack(stack: HistroyStack) {
    this.stack = stack.clone();
  }

  abstract initialize(): void;
  static getInstance(paintboard: PaintBoard) {}
}

export class IEPaintBoardHistory extends PaintBoardHistory {
  private static instance: IEPaintBoardHistory;
  override initialize(): void {}

  static override getInstance(paintboard: IEPaintBoard): IEPaintBoardHistory {
    if (!this.instance) {
      this.instance = new IEPaintBoardHistory(paintboard);
    }
    return this.instance;
  }
}

export class ChromePaintBoardHistory extends PaintBoardHistory {
  private static instance: ChromePaintBoardHistory;
  override initialize(): void {}

  static override getInstance(
    paintboard: ChromePaintBoard
  ): ChromePaintBoardHistory {
    if (!this.instance) {
      this.instance = new ChromePaintBoardHistory(paintboard);
    }
    return this.instance;
  }
}
