# minimal-wschat
Websocketを使うチャットアプリ。改造しやすく、ちいさくてシンプルでありたい。
煮るなり焼くなり改良するなり、お好きにどうぞ。

# Requirements

以下の環境でのみ動作確認しています。

Verified only in the following:
```
 - python-3.14.3
 - fastapi==0.135.2
 - uvicorn==0.42.0 
 - websockets==16.0
```

（必須ではない）動作サンプル用チャットボットのみ：

(Optional) Example chatbot only　:
```
 - openai==2.29
```


# Getting Started

## Install
### Clone repository
```
git clone https://github.com/fuminagasawa/minimal-wschat
cd minimal-wschat
```

### Create venv

お好みの方法で仮想環境をつくるべし

Set up a venv using your preferred method.

#### venv
```shell:in_venv.sh
pyhton -m venv .minimal_wschat
source .minimal_wschat/bin/activate
```

#### Anaconda ( or Miniconda )
```shell:in_anaconda.sh
conda create -n minimal_wschat python=3.14
conda activate minimal_wschat
```


### Inistall requirements
```
pip install -r ./requirements.txt
```

## Run
以下のコマンドでサーバを起動する
```
python ./chatserver.py
```

サーバが起動したら
http://localhost:8080/ 
をブラウザで開く

