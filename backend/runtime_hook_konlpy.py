import os, sys, jpype
from glob import glob
from konlpy import jvm

base = sys._MEIPASS if getattr(sys, "frozen", False) else os.path.dirname(jvm.__file__)
jar_dir = os.path.join(base, "konlpy", "java")
jars = glob(os.path.join(jar_dir, "*.jar"))
print("Konlpy hook jars:", jars)  # 디버깅용 출력

if not jpype.isJVMStarted():
  jpype.startJVM(
    jpype.getDefaultJVMPath(),
    "-ea",
    *["-Djava.class.path=" + jar for jar in jars]
  )