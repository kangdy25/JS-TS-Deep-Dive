import PaintBoard from "./PaintBoard_with_Browser/PaintBoardBase.js";
import ChromePaintBoard from "./PaintBoard_with_Browser/ChromePaintBoard.js";
import IEPaintBoard from "./PaintBoard_with_Browser/IEPaintBoard.js";

export abstract class PaintBoardHistory {
    paintboard: PaintBoard;
    protected constructor(paintboard: PaintBoard) {
        this.paintboard = paintboard;
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
