import ChromePaintBoard from "./PaintBoard_with_Browser/ChromePaintBoard.js";
import IEPaintBoard from "./PaintBoard_with_Browser/IEPaintBoard.js";
// -------------------------------------------------
//   Simple Factory Pattern (간단한 팩토리)
// -------------------------------------------------
// => 객체 생성 로직을 한 곳에 모아두는 패턴
//    클라이언트는 '무엇을 만들지'는 알지만 '어떻게 만드는지'는 몰라도 됨
//    새로운 제품이 추가될 때는 if문(또는 switch문)만 수정하면 됨
function paintboardFactory(type) {
    // type 매개변수에 따라 다른 객체 생성
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
