import PaintBoard from "./FactoryMethod.js";
import ChromePaintBoard from "./PaintBoard_with_Browser/ChromePaintBoard.js";
import IEPaintBoard from "./PaintBoard_with_Browser/IEPaintBoard.js";

export abstract class PaintBoardMenu {
  paintboard: PaintBoard;
  protected constructor(paintboard: PaintBoard) {
    this.paintboard = paintboard;
  }

  abstract initialize(): void;
  static getInstance(paintboard: PaintBoard) {}
}

export class IEPaintBoardMenu extends PaintBoardMenu {
  private static instance: IEPaintBoardMenu;
  override initialize(): void {}

  static override getInstance(paintboard: IEPaintBoard): IEPaintBoardMenu {
    if (!this.instance) {
      this.instance = new IEPaintBoardMenu(paintboard);
    }
    return this.instance;
  }
}

export class ChromePaintBoardMenu extends PaintBoardMenu {
  private static instance: ChromePaintBoardMenu;
  override initialize(): void {}

  static override getInstance(
    paintboard: ChromePaintBoard
  ): ChromePaintBoardMenu {
    if (!this.instance) {
      this.instance = new ChromePaintBoardMenu(paintboard);
    }
    return this.instance;
  }
}
