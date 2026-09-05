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

class URL:
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
        s = socket.socket(
            family=socket.AF_INET, # 다른 컴퓨터를 찾는 주소 패밀리
            type=socket.SOCK_STREAM, # 임의의 양의 데이터를 전송하는 소켓의 타입
            proto=socket.IPPROTO_TCP # 두 컴퓨터가 연결을 설정하는 단계를 설정하는 프로토콜
        )
        # http, https 각각에 맞는 포트에 연결
        s.connect((self.host, self.port))

        # ssl 라이브러리를 활용하여 소켓을 감싸줌
        if self.scheme == "https":
            ctx = ssl.create_default_context()
            s = ctx.wrap_socket(s, server_hostname=self.host)

        # 호스트 이름 뒤 콜론을 붙여 URL에 지정하는 사용자 지정 포트에 대한 지원 추가
        if ":" in self.host:
            self.host, port = self.host.split(":", 1)
            self.port = int(port)

        # format 메서드를 통해 path와 host 바인딩
        request = "GET {} HTTP/1.0\r\n".format(self.path)
        request += "Host: {}\r\n".format(self.host)
        request += "\r\n" # 두 번의 줄바꿈을 통해 서버에 요청 전송
        s.send(request.encode("utf8")) # encode()는 텍스트를 바이트로 변환함

        # 바이트가 포함된 파일 형식의 객체를 반환하며 루프를 감추는 헬퍼 함수 makefile 사용
        response = s.makefile("r", encoding="utf8", newline="\r\n")
        statusline = response.readline()
        version, status, explanation = statusline.split(" ", 2)

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

# 태그 제거 후, 텍스트만 화면에 출력
def lex(body):
    text = ""
    in_tag = False
    for c in body:
        if c == "<":
            in_tag = True # 태그 시작 지점
        elif c == ">":
            in_tag = False # 태그 끝 지점
        elif not in_tag:
            text += c # 태그 밖의 실제 텍스트 문자만 누적
    return text

# 텍스트의 각 문자가 배치될 절대 좌표를 계산하여 디스플레이 리스트 생성하기
def layout(text):
    font = tkinter.font.Font()
    display_list = []
    cursor_x, cursor_y = HSTEP, VSTEP
    for word in text.split(): # 텍스트를 한 번에 한 단어 단위로 배치
        w = font.measure(word) # 단어의 너비 측정
        display_list.append((cursor_x, cursor_y, word))
        cursor_x += w + font.measure(" ") # 단어 사이에 공백을 둠
        
        # 캔버스 오른쪽 경계에 도달하면 다음 줄로 줄바꿈(Word wrap 기초)
        if cursor_x + w > WIDTH - HSTEP:
            cursor_y += font.metrics("linespace") * 1.25 # 가독성을 위하여 1.25를 곱함
            cursor_x = HSTEP # x 위치를 줄의 맨 처음으로 리셋
    return display_list

class Browser:
    def __init__(self):
        # GUI 윈도우 생성 및 캔버스 위젯 배치
        self.window = tkinter.Tk()
        self.canvas = tkinter.Canvas(self.window, width=WIDTH, height=HEIGHT)
        self.canvas.pack()
        self.scroll = 0
        # 아래쪽 방향키를 눌렀을 때 스크롤 다운 함수 호출 바인딩
        self.window.bind("<Down>", self.scrolldown)

    # 전체 브라우저 동작 흐름을 묶어서 실행하는 진입점
    def load(self, url):
        body = url.request()
        text = lex(body)
        self.display_list = layout(text)
        self.draw()

    # 디스플레이 리스트를 순회하며 캔버스에 그리기(페인팅 단계)
    def draw(self):
        self.canvas.delete("all")
        for x, y, c in self.display_list:
            # 화면(뷰포트) 밖으로 벗어난 문자는 건너뛰기
            if y > self.scroll + HEIGHT: continue
            if y + VSTEP < self.scroll: continue
            # 절대 y 좌표에서 스크롤 오프셋을 뺀 상대 위치에 문자 그리기
            self.canvas.create_text(x, y - self.scroll, text=c, anchor='nw')

    # 아래 방향키 입력 이벤트 핸들러
    def scrolldown(self, e):
        self.scroll += SCROLL_STEP
        self.draw()


# 커맨드 라인에서 이 스크립트를 실행했을 때만 실행됨
if __name__ == "__main__":
    import sys
    Browser().load(URL(sys.argv[1]))
    tkinter.mainloop()

