import ChromePaintBoard from "./PaintBoard_with_Browser/ChromePaintBoard";
import IEPaintBoard from "./PaintBoard_with_Browser/IEPaintBoard";
function paintboardFactory(type) {
    if (type === "ie") {
        return IEPaintBoard.getInstance();
    }
    else if (type === "chrome") {
        return ChromePaintBoard.getInstance();
    }
    else {
        throw new Error("일치하는 타입이 없습니다.");
    }
}
export default paintboardFactory;
