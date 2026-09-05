import socket
import ssl
import tkinter
import tkinter.font

# 화면 기본 해상도 설정
WIDTH, HEIGHT = 800, 600
# 문자 하나당 차지할 가로 간격(HSTEP)과 세로 줄 간격(VSTEP)
HSTEP, VSTEP = 13, 18
# 스크롤 이동 시 한 번에 이동할 픽셀 단위
SCROLL_STEP = 100
# Tkinter의 Font 객체 생성 및 가비지 컬렉션 방지를 위한 전역 캐시
FONTS = {}

class URL:
    """
    HTTP/HTTPS 스키마를 파싱하고 TCP 소켓을 통해 원격 리소스를 가져오는 클래스
    """
    def __init__(self, url):
        # ://을 기준으로 scheme과 url을 분할하기
        self.scheme, url = url.split("://", 1)
        assert self.scheme in ["http", "https"]

        if "/" not in url:
            url = url + "/"
        # /를 기준으로 host와 path를 분할하기
        self.host, url = url.split("/", 1)
        self.path = "/" + url

        # http와 https의 포트 분기
        if self.scheme == "http":
            self.port = 80
        elif self.scheme == "https":
            self.port = 443

    def request(self):
        # 호스트명 뒤에 지정된 커스텀 포트가 있다면 분리 (URL에 포트가 명시된 경우 호스트와 포트 분리)
        if ":" in self.host:
            self.host, port = self.host.split(":", 1)
            self.port = int(port)

        s = socket.socket(
            family=socket.AF_INET, # 다른 컴퓨터를 찾는 주소 패밀리
            type=socket.SOCK_STREAM, # 임의의 양의 데이터를 전송하는 소켓의 타입
            proto=socket.IPPROTO_TCP # 두 컴퓨터가 연결을 설정하는 단계를 설정하는 프로토콜
        )

        # ssl 라이브러리를 활용하여 소켓을 감싸줌
        if self.scheme == "https":
            ctx = ssl.create_default_context()
            s = ctx.wrap_socket(s, server_hostname=self.host)

        # http, https 각각에 맞는 포트에 연결
        s.connect((self.host, self.port)) 

        # format 메서드를 통해 path와 host 바인딩
        request = "GET {} HTTP/1.0\r\n".format(self.path)
        request += "Host: {}\r\n".format(self.host)
        request += "\r\n" # 두 번의 줄바꿈을 통해 서버에 요청 전송
        s.send(request.encode("utf8")) # encode()는 텍스트를 바이트로 변환함

        # 바이트가 포함된 파일 형식의 객체를 반환하며 루프를 감추는 헬퍼 함수 makefile 사용
        response = s.makefile("r", encoding="utf8", newline="\r\n")
        statusline = response.readline()
        version, status, explanation = statusline.split(" ", 2)

        # 응답 헤더 파싱 루프 (소문자 정규화 처리)
        response_headers = {}
        while True:
            line = response.readline()
            if line == "\r\n": break # 빈줄을 만나면 헤더 파싱 루프 종료
            header, value = line.split(":", 1) # 콜론(:)을 기준으로 헤더 이름과 헤더 값 분리
            response_headers[header.casefold()] = value.strip() # 소문자 표준화 및 공백, 줄바꿈 문자 제거

        assert "transfer-encoding" not in response_headers
        assert "content-encoding" not in response_headers

        # 헤더 이후 남은 데이터 스트림을 모두 읽어오고 소켓 연결 해제
        body = response.read()
        s.close()

        # 수신된 최종 문자열 반환
        return body

class Text:
    """순수 텍스트 노드를 나타내는 토큰"""
    def __init__(self, text):
        self.text = text

class Tag:
    """HTML 마크업 태그를 나타내는 토큰 (예: b, /b, i, /i, p, br)"""
    def __init__(self, tag):
        self.tag = tag

def lex(body):
    """
    HTML 원시 문자열을 읽어 Tag와 Text 객체의 스트림으로 변환하는 어휘 분석기(Lexer)
    """
    out = []
    buffer = ""
    in_tag = False
    for c in body:
        if c == "<":
            in_tag = True # 태그 시작 지점
            if buffer: out.append(Text(buffer))
            buffer = ""
        elif c == ">":
            in_tag = False # 태그 끝 지점
            out.append(Tag(buffer))
            buffer = ""
        else:
            buffer += c # 태그 밖의 실제 텍스트 문자만 누적

    # 태그가 닫히지 않고 문서가 끝났을 때 남은 텍스트 flush
    if not in_tag and buffer:
        out.append(Text(buffer))
    return out

def get_font(size, weight, slant):
    """
    Tkinter 폰트 객체 생성 및 캐싱 함수,
    폰트 객체 누수 방지 및 메모리 해제를 막기 위해 임베딩된 Label 위젯과 함께 보관
    """
    key = (size, weight, slant)
    if key not in FONTS:
        font = tkinter.font.Font(size=size, weight=weight, slant=slant)
        label = tkinter.Label(font=font) # Tkinter 내부 캐시 참조 유지
        FONTS[key] = (font, label)
    return FONTS[key][0]

class Layout:
    """
    토큰 스트림을 순회하며 텍스트 래핑, 베이스라인(Baseline) 정렬을 계산하여
    화면에 그릴 요소 목록(display_list)을 생성하는 레이아웃 엔진
    """
    def __init__(self, tokens):
        self.display_list = []

        # 커서의 초기 위치 및 폰트 상태 머신 기본값
        self.cursor_x = HSTEP
        self.cursor_y = VSTEP
        self.weight = "normal"
        self.slant = "roman"
        self.size = 12

        # 현재 줄에 포함될 단어 임시 버퍼: [(x, word, font), ...]
        self.line = []

        for tok in tokens:
            self.token(tok)
        self.flush() # 문서의 마지막 줄 확정

    def token(self, tok):
        """토큰 타입에 따라 서식 상태 머신을 전이하거나 단어 단위 배치 수행"""
        if isinstance(tok, Text):
            for word in tok.text.split():
                self.word(word)
        elif tok.tag == "i":
            self.slant = "italic"
        elif tok.tag == "/i":
            self.slant = "roman"
        elif tok.tag == "b":
            self.weight = "bold"
        elif tok.tag == "/b":
            self.weight = "normal"
        elif tok.tag == "small":
            self.size -= 2
        elif tok.tag == "/small":
            self.size += 2
        elif tok.tag == "big":
            self.size += 4
        elif tok.tag == "/big":
            self.size -= 4
        elif tok.tag == "br":
            self.flush()
        elif tok.tag == "/p":
            self.flush()
            self.cursor_y += VSTEP # 단락 간 추가 여백

    def word(self, word):
        """단어의 너비를 측정하고 Word wrap(줄바꿈) 여부를 판단하여 line 버퍼에 적재"""
        font = get_font(self.size, self.weight, self.slant)
        w = font.measure(word) # 단어의 너비 측정

        # 캔버스 오른쪽 경계에 도달하면 다음 줄로 줄바꿈
        if self.cursor_x + w > WIDTH - HSTEP:
            self.flush()

        self.line.append((self.cursor_x, word, font))
        self.cursor_x += w + font.measure(" ") # 단어 사이에 공백을 둠

    def flush(self):
        """
        한 줄(line) 내 여러 폰트 크기/스타일 중 가장 큰 ascent/descent를 기반으로
        기준선(baseline)을 계산하고, 개별 단어의 절대 Y 좌표를 확정
        """
        if not self.line: return

        # 해당 줄에 포함된 폰트들의 메트릭 정보 수집
        metrics = [font.metrics() for x, word, font in self.line]
        max_ascent = max([metric["ascent"] for metric in metrics])
        baseline = self.cursor_y + 1.25 * max_ascent

        # 기준선(baseline)을 바탕으로 각 단어의 Y 좌표 계산 (Baseline Alignment)
        for x, word, font in self.line:
            y = baseline - font.metrics()["ascent"]
            self.display_list.append((x, y, word, font))

        # 가장 긴 descent를 고려해 다음 줄의 시작 Y 좌표 계산
        max_descent = max([metric["descent"] for metric in metrics])
        self.cursor_y = baseline + 1.25 * max_descent
        self.cursor_x = HSTEP
        self.line = []

class Browser:
    """GUI 윈도우 관리 및 디스플레이 리스트를 캔버스에 렌더링하는 진입 클래스"""
    def __init__(self):
        # GUI 윈도우 생성 및 캔버스 위젯 배치
        self.window = tkinter.Tk()
        self.canvas = tkinter.Canvas(self.window, width=WIDTH, height=HEIGHT)
        self.canvas.pack()
        self.scroll = 0
        # 키보드 이벤트 바인딩 (아래쪽 방향키)
        self.window.bind("<Down>", self.scrolldown)

    def load(self, url):
        """네트워크 요청 -> 어휘 분석 -> 레이아웃 계산 -> 페인팅 전체 파이프라인 수행"""
        body = url.request()
        tokens = lex(body)
        self.display_list = Layout(tokens).display_list
        self.draw()

    def draw(self):
        """
        디스플레이 리스트를 순회하며 뷰포트 영역(화면)에 들어오는 텍스트만 캔버스에 그리기
        (화면 밖 요소 컬링 처리)
        """
        self.canvas.delete("all")
        for x, y, word, font in self.display_list:
            # 뷰포트 하단보다 아래에 위치하면 그리지 않음
            if y > self.scroll + HEIGHT: continue
            # 뷰포트 상단보다 완전히 위에 위치하면 그리지 않음
            if y + VSTEP < self.scroll: continue
            # 절대 y 좌표에서 스크롤 오프셋을 뺀 상대 위치에 문자 그리기
            self.canvas.create_text(x, y - self.scroll, text=word, font=font, anchor='nw')

    def scrolldown(self, e):
        """아래 방향키 입력 시 스크롤 오프셋을 증가시키고 다시 그리기(Repaint)"""
        self.scroll += SCROLL_STEP
        self.draw()


# 커맨드 라인에서 이 스크립트를 실행했을 때만 실행됨
if __name__ == "__main__":
    import sys
    Browser().load(URL(sys.argv[1]))
    tkinter.mainloop()

