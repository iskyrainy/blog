---
title: Read Code-ArrayList
category: Tech
tag: [Java, ReadCode]
date: 2025-04-27T09:52:41+08:00
---

# ReadCode-ArrayList

## `ArrayList`は`RandomAccess`インターフェースを実装しており、ランダムアクセスをサポートしています

RandomAccessはJavaのマーカーインターフェースであり、高速なランダムアクセスをサポートするコレクションを示すために使用されます。コレクションがRandomAccessインターフェースを実装している場合、インデックスを通じてコレクション内の要素に直接アクセスでき、走査する必要がありません。逆に、コレクションがRandomAccessインターフェースを実装していない場合、イテレータを通じてのみコレクション内の要素を走査できます。

Javaでは、ArrayListは配列ベースのコレクションであるため、RandomAccessインターフェースを実装しており、インデックスを通じて要素に直接アクセスできます。一方、LinkedListはリンクリストベースのコレクションであるため、RandomAccessインターフェースを実装しておらず、イテレータを通じてのみ要素を走査できます。

RandomAccessインターフェース自体はメソッドを定義しておらず、コレクションが高速なランダムアクセスをサポートしているかどうかをマークするためにのみ使用されます。コレクションがRandomAccessインターフェースを実装している場合、Collectionsユーティリティクラスが提供するbinarySearchメソッドを使用して二分探索を行い、要素をより速く検索できます。

```JAVA
public class ArrayList<E> extends AbstractList<E>
        implements List<E>, RandomAccess, Cloneable, java.io.Serializable
```



## `modCount`の詳細解説

Javaのコレクションにおいて、modCountはカウンタであり、コレクションの構造的変更の回数を記録するために使用されます。コレクションの構造が変化したとき、例えば要素の追加や削除時に、modCountカウンタが増加します。例えば、ArrayList、HashMap、HashSetなどのコレクションクラスにはmodCountカウンタがあります。

modCountはコレクションのフェイルファスト機構をサポートするために使用されます。コレクションを反復処理する際にmodCountの値が変更されたことを検出すると、ConcurrentModificationException例外がスローされます。これは、コレクションを並行して変更する際にデータの不整合やセキュリティ問題が発生するのを避けるためです。

modCount属性は通常、フェイルファスト（fail-fast）機構を実装するために使用され、マルチスレッド環境において、コレクションが走査されている最中にそのコレクションが変更された場合、modCountの値をチェックすることでConcurrentModificationException例外をスローし、プログラムの安全性を保証できます。

以下は、マルチスレッド環境でmodCountを使用してフェイルファスト機構を実装する方法を示す例です：

```java
public class MyList<E> extends AbstractList<E> {
    private ArrayList<E> internalList = new ArrayList<>();
    private int modCount = 0;

    public void add(int index, E element) {
        modCount++;
        internalList.add(index, element);
    }

    public E remove(int index) {
        modCount++;
        return internalList.remove(index);
    }

    public E get(int index) {
        return internalList.get(index);
    }

    public int size() {
        return internalList.size();
    }

    public Iterator<E> iterator() {
        return new Iterator<E>() {
            private int expectedModCount = modCount;
            private int currentIndex = 0;

            public boolean hasNext() {
                return currentIndex < size();
            }

            public E next() {
                checkForModification();
                if (!hasNext()) {
                    throw new NoSuchElementException();
                }
                return internalList.get(currentIndex++);
            }

            private void checkForModification() {
                if (modCount != expectedModCount) {
                    throw new ConcurrentModificationException();
                }
            }
        };
    }
}

```

MyListクラスはAbstractListクラスを継承し、add、remove、get、sizeメソッドを実装しています。addとremoveメソッドでは、modCount属性が増加されます。iteratorメソッドでは、各走査の前にmodCountとexpectedModCountが等しいかどうかをチェックし、等しくない場合はConcurrentModificationException例外をスローします。

注意すべき点は、modCountは並行変更例外の一部しか捕捉できないことです。例えば、あるスレッドが要素を削除し、別のスレッドが同時に別の要素を変更した場合、例外はスローされません。したがって、並行環境では、データの一貫性とスレッド安全性を保証するために専用の並行コレクションクラスを使用する必要があります。



## `ArrayList`のデフォルトサイズは10です。

```java
private static final int DEFAULT_CAPACITY = 10;
```

初期化を通じて`capacity`のサイズを自由に定義できます：

```java
    // init with a size selected by coder.
	public ArrayList(int initialCapacity) {
        if (initialCapacity > 0) {
            this.elementData = new Object[initialCapacity];
        } else if (initialCapacity == 0) {
            this.elementData = EMPTY_ELEMENTDATA;
        } else {
            throw new IllegalArgumentException("Illegal Capacity: "+
                                               initialCapacity);
        }
    }

	// empty list and capacity is 10.
    public ArrayList() {
        this.elementData = DEFAULTCAPACITY_EMPTY_ELEMENTDATA;
    }

	// if c is ArrayList then make a list containing the elements of the c.
    public ArrayList(Collection<? extends E> c) {
        Object[] a = c.toArray();
        if ((size = a.length) != 0) {
            if (c.getClass() == ArrayList.class) {
                elementData = a;
            } else {
                elementData = Arrays.copyOf(a, size, Object[].class);
            }
        } else {
            // replace with empty array.
            elementData = EMPTY_ELEMENTDATA;
        }
    }
```



## `trimToSize`の詳細解説

まず三項演算子を使用して、現在のArrayListに要素が存在するかどうかを判断します。現在のsizeが0の場合、`elementData`を`EMPTY_ELEMENTDATA`、つまり長さ0の空の配列を指すようにします。そうでない場合、`Arrays.copyOf()`メソッドを使用して`elementData`配列内の要素を新しい配列にコピーし、新しい配列の長さをsizeに設定します。最終的に、`elementData`は新しい配列を指します。

この操作の主な目的は、ArrayListオブジェクトが占有するメモリ空間を削減することです。ArrayListは実際の使用過程で、要素の数と占有するメモリ空間が絶えず変化する可能性があるため、大量の空間の無駄が存在する可能性があります。`trimToSize()`メソッドを呼び出すことで、これらの空きメモリ空間を解放し、プログラムのメモリ使用効率を向上させることができます。

```java
    public void trimToSize() {
        modCount++;
        if (size < elementData.length) {
            elementData = (size == 0)
              ? EMPTY_ELEMENTDATA
              : Arrays.copyOf(elementData, size);
        }
    }
```



## `grow`の詳細解説

元の`list`が空でない場合、`newLength()`メソッドを使用して新しい`list`のサイズを計算します。

```java
    private Object[] grow(int minCapacity) {
        int oldCapacity = elementData.length;
        if (oldCapacity > 0 || elementData != DEFAULTCAPACITY_EMPTY_ELEMENTDATA) {
            /** 
             * newLength will return the number after count.
             * oldCapacity is the size of list now.
             * minCapacity - oldCapacity is the size will enlarge.
             * oldCapacity >> 1 is the size will be enlarged at least.
            **/
            int newCapacity = ArraysSupport.newLength(oldCapacity,
                    minCapacity - oldCapacity, /* minimum growth */
                    oldCapacity >> 1           /* preferred growth */);
            return elementData = Arrays.copyOf(elementData, newCapacity);
        } else {
            return elementData = new Object[Math.max(DEFAULT_CAPACITY, minCapacity)];
        }
    }

    private Object[] grow() {
        return grow(size + 1);
    }

	// if list is not null, count the new list's size.
    public static int newLength(int oldLength, int minGrowth, int prefGrowth) {
        // preconditions not checked because of inlining
        // assert oldLength >= 0
        // assert minGrowth > 0

        int prefLength = oldLength + Math.max(minGrowth, prefGrowth); // might overflow
        if (0 < prefLength && prefLength <= SOFT_MAX_ARRAY_LENGTH) {
            return prefLength;
        } else {
            // put code cold in a separate method
            return hugeLength(oldLength, minGrowth);
        }
    }

    private static int hugeLength(int oldLength, int minGrowth) {
        int minLength = oldLength + minGrowth;
        if (minLength < 0) { // overflow
            throw new OutOfMemoryError(
                "Required array length " + oldLength + " + " + minGrowth + " is too large");
        } else if (minLength <= SOFT_MAX_ARRAY_LENGTH) {
            return SOFT_MAX_ARRAY_LENGTH;
        } else {
            return minLength;
        }
    }

```



## `contains()/lastIndexOf()`の詳細解説

`o == null`の場合、`elementData`を走査し、`null`が存在すれば対応する`index`を返します。`o != null`の場合、`elementData`が`o`を含むかどうかを走査し、対応する`index`を返します。それ以外の場合は`-1`を返します。

同様に`lastIndexOf()`の原理も似ています。`o == null`の場合、`elementData`を後ろから前に走査し、`null`が存在すれば対応する`index`を返します。`o != null`の場合、`elementData`を後ろから前に走査し、`o.equals(elementData[i])`が存在すれば対応する`index`を返します。それ以外の場合は`-1`を返します。ソースコードは`contains()`と似ているため省略します。

```java
    // judge 'o' is or not this list's data.
    public boolean contains(Object o) {
        return indexOf(o) >= 0;
    }
	
    public int indexOf(Object o) {
        return indexOfRange(o, 0, size);
    }

    int indexOfRange(Object o, int start, int end) {
        Object[] es = elementData;
        if (o == null) {
            for (int i = start; i < end; i++) {
                if (es[i] == null) {
                    return i;
                }
            }
        } else {
            for (int i = start; i < end; i++) {
                if (o.equals(es[i])) {
                    return i;
                }
            }
        }
        return -1;
    }
```



## `clone()`の詳細解説

```java
    // this method will returns a shallow copy of this arraylist instance, rather than referencece those object by itself.
	// For example, consider an object 'person' that contains a reference to another object 'address'. If a shallow copy is made of 'person', the new object will contain a reference to the same 'address' object as the original 'person' object, rather than creating a new copy of the 'address' object.
	public Object clone() {
        try {
            ArrayList<?> v = (ArrayList<?>) super.clone();
            v.elementData = Arrays.copyOf(elementData, size);
            v.modCount = 0;
            return v;
        } catch (CloneNotSupportedException e) {
            // this shouldn't happen, since we are Cloneable
            throw new InternalError(e);
        }
    }
```



## `toArray()`の詳細解説

パラメータaを受け取り、要素を変換するターゲット配列を示します。aの長さが`ArrayList`の`size`より小さい場合、同じ型の新しい配列を作成し、`ArrayList`内の要素をその配列にコピーします。

aの長さが`ArrayList`の`size`以上の場合、`ArrayList`内の要素は直接aにコピーされます。aの長さが`ArrayList`の`size`より大きい場合、aの`size`番目の要素は`null`に設定されます。

このメソッドは変換された配列を返します。注意すべき点は、ターゲット配列の型が`ArrayList`の要素型のサブタイプでない場合、`toArray`メソッドは新しい配列を返すことです。この状況を防ぐために、ジェネリクスを使用して、ターゲット配列の型を`toArray`メソッドのパラメータとして渡すことができます。

```java
    @SuppressWarnings("unchecked")
    public <T> T[] toArray(T[] a) {
        if (a.length < size)
            // Make a new array of a's runtime type, but my contents:
            return (T[]) Arrays.copyOf(elementData, size, a.getClass());
        System.arraycopy(elementData, 0, a, 0, size);
        if (a.length > size)
            a[size] = null;
        return a;
    }
```



## `set()`の詳細解説

`index`が有効かどうかをチェックし、以前の`index`位置の`element`を返します。`modCount`の値は変更しません。

```java
    public E set(int index, E element) {
        rangeCheck(index);

        E oldValue = elementData(index);
        elementData[index] = element;
        return oldValue;
    }
```



## `remove()`の詳細解説

`arraycopy()`を使用して`index`以降の要素を前方にコピーして移動します。時間計算量は`O(N)`です。

```java
    public E remove(int index) {
        rangeCheck(index);

        modCount++;
        E oldValue = elementData(index);

        int numMoved = size - index - 1;
        if (numMoved > 0)
            System.arraycopy(elementData, index+1, elementData, index,
                             numMoved);
        elementData[--size] = null; // clear to let GC do its work

        return oldValue;
    }
```

理解しやすいです。

```java
    public boolean remove(Object o) {
        final Object[] es = elementData;
        final int size = this.size;
        int i = 0;
        found: {
            if (o == null) {
                for (; i < size; i++)
                    if (es[i] == null)
                        break found;
            } else {
                for (; i < size; i++)
                    if (o.equals(es[i]))
                        break found;
            }
            return false;
        }
        fastRemove(es, i);
        return true;
    }

	/**
     * Private remove method that skips bounds checking and does not
     * return the value removed.
     */
    private void fastRemove(Object[] es, int i) {
        modCount++;
        final int newSize;
        if ((newSize = size - 1) > i)
            System.arraycopy(es, i + 1, es, i, newSize - i);
        es[size = newSize] = null;
    }
```



## `equals()`の詳細解説

オブジェクト`o`が`this`が指すオブジェクトと等しい場合、直接`true`を返します。

`o`が`List`およびそのサブクラスのインスタンスでない場合、`false`を返します。

`o`が`ArrayList`のインスタンスである場合、`equalsArrayList()`を呼び出し、そうでない場合は`equalsRange()`を呼び出します。

`modCount`をチェックし、`modCount != expectedModCount`の場合、`ConcurrentModificationException`例外をスローします。

```java
    public boolean equals(Object o) {
        if (o == this) {
            return true;
        }

        if (!(o instanceof List)) {
            return false;
        }

        final int expectedModCount = modCount;
        // ArrayList can be subclassed and given arbitrary behavior, but we can
        // still deal with the common case where o is ArrayList precisely
        boolean equal = (o.getClass() == ArrayList.class)
            ? equalsArrayList((ArrayList<?>) o)
            : equalsRange((List<?>) o, 0, size);

        checkForComodification(expectedModCount);
        return equal;
    }

    boolean equalsRange(List<?> other, int from, int to) {
        final Object[] es = elementData;
        // if to > es.length, overborder.
        if (to > es.length) {
            throw new ConcurrentModificationException();
        }
        var oit = other.iterator();
        for (; from < to; from++) {
            // if 'other' has not next element, return false;
            // if other's element is not equals with this object's element, return false.
            if (!oit.hasNext() || !Objects.equals(es[from], oit.next())) {
                return false;
            }
        }
        // if 'other' still has next element, return false;
        // if 'other' has not any element, return true.
        return !oit.hasNext();
    }

    private boolean equalsArrayList(ArrayList<?> other) {
        // keep other.modCount, if 'other' be changed by other threads, throw exception.
        final int otherModCount = other.modCount;
        final int s = size;
        boolean equal;
        if (equal = (s == other.size)) {
            final Object[] otherEs = other.elementData;
            final Object[] es = elementData;
            // overborder
            if (s > es.length || s > otherEs.length) {
                throw new ConcurrentModificationException();
            }
            for (int i = 0; i < s; i++) {
                if (!Objects.equals(es[i], otherEs[i])) {
                    equal = false;
                    break;
                }
            }
        }
        other.checkForComodification(otherModCount);
        return equal;
    }

    private void checkForComodification(final int expectedModCount) {
        if (modCount != expectedModCount) {
            throw new ConcurrentModificationException();
        }
    }
```



## `hashCode()`の詳細解説

```java
    public int hashCode() {
        int expectedModCount = modCount;
        int hash = hashCodeRange(0, size);
        checkForComodification(expectedModCount);
        return hash;
    }

    int hashCodeRange(int from, int to) {
        final Object[] es = elementData;
        // overborder
        if (to > es.length) {
            throw new ConcurrentModificationException();
        }
        int hashCode = 1;
        // compute hashCode
        for (int i = from; i < to; i++) {
            Object e = es[i];
            hashCode = 31 * hashCode + (e == null ? 0 : e.hashCode());
        }
        return hashCode;
    }
```



## `addAll()`の詳細解説

`a = c.toArray()`が空の場合、`false`を返します。`a`が空でなく、`a.length > (elementData.length - size)`の場合、`grow()`を呼び出して`elementData`を拡張し、その後`arraycopy()`を使用して`a`を`elementData`にコピーします。

```java
    public boolean addAll(Collection<? extends E> c) {
        Object[] a = c.toArray();
        modCount++;
        int numNew = a.length;
        if (numNew == 0)
            return false;
        Object[] elementData;
        final int s;
        if (numNew > (elementData = this.elementData).length - (s = size))
            elementData = grow(s + numNew);
        System.arraycopy(a, 0, elementData, s, numNew);
        size = s + numNew;
        return true;
    }
```



## `batchRemove()`の詳細解説

このメソッドは、`Collection`型のパラメータ`c`、boolean型のパラメータ`complement`、int型のパラメータ`from`とint型のパラメータ`end`を受け取ります。`c`は削除する要素のコレクションを示し、`complement`がtrueの場合はcに存在しない要素を削除し、そうでない場合はcに存在する要素を削除します。fromとendは削除する要素の開始位置と終了位置を示し、fromを含みendを含みません。

まず、このメソッドはcomplementの値に基づいてrの初期値を決定します。rが指す要素を削除する必要がない場合、rを右に移動し続けて削除が必要な要素を見つけます。このとき、rは最初の削除が必要な要素を指し、wは次の要素の位置を指します。

次に、rから始まる後続の要素の中で削除が不要な要素を見つけ、それをwの位置に移動し、同時にwを1つ右に移動します。指定された範囲内のすべての要素を走査し終えると、wが指す位置は次の削除が不要な要素の位置、つまりwとその右側の要素を削除する必要があります。

最後に、要素配列のwからendまでの要素を左にw - end分移動し、同時にmodCountを更新してArrayListへの変更回数を示します。

`example:`

数字を格納するArrayListがあり、内容が以下のようであるとします：

```java
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

その中のすべての偶数要素（つまり2、4、6、8、10）を削除したいとします。偶数を格納するHashSetを作成し、それをbatchRemoveメソッドにパラメータとして渡すことができます。具体的なコードは以下の通りです：

```java
ArrayList<Integer> list = new ArrayList<>(Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
HashSet<Integer> set = new HashSet<>(Arrays.asList(2, 4, 6, 8, 10));
list.batchRemove(set, false, 0, list.size());
```

ここで、最初のパラメータは偶数を格納するHashSet、2番目のパラメータはfalseでHashSet内のすべての要素を削除することを示し、3番目のパラメータは0でリストの先頭からスキャンを開始することを示し、4番目のパラメータはリストのサイズでリストの末尾までスキャンすることを示します。

batchRemoveメソッド内部では、まずループを通じて最初に削除する必要がある要素の位置を見つけ、その後その位置から、削除が不要な要素を前方に移動し、最後に残りの要素を削除します。具体的なプロセスは以下の通りです：

1. 位置0からスキャンを開始し、要素1を見つけ、削除不要なのでスキャンを続行します。
2. 位置1からスキャンを開始し、要素2を見つけ、削除が必要なのでループを抜けます。
3. 位置1をrとして記録し、位置2から、削除が不要な要素1を1つ前に移動し、位置1の要素2を上書きします。

```java
[1, 3, 4, 5, 6, 7, 8, 9, 10, 10]
   r
   w
```

4. 位置2からスキャンを開始し、要素3を見つけ、削除不要なので位置w（1）に移動し、wを1つインクリメントします。

```java
[1, 3, 4, 5, 6, 7, 8, 9, 10, 10]
   r
      w
```

5. 位置3からスキャンを開始し、要素4を見つけ、削除が必要なのでスキップします。

6. 位置4からスキャンを開始し、要素5を見つけ、削除不要なので位置w（2）に移動し、wを1つインクリメントします。

```java
[1, 3, 5, 5, 6, 7, 8, 9, 10, 10]
   r
         w
```

7. 位置5からスキャンを開始し、要素6を見つけ、削除が必要なのでスキップします。

8. 位置6からスキャンを開始し、要素7を見つけ、削除不要なので位置w（3）に移動し、wを1つインクリメントします。

```java
[1, 3, 5, 7, 6, 7, 8, 9, 10, 10]
   r
            w
```

`try`ブロックが終了するまで続行します。

......

```java
    boolean batchRemove(Collection<?> c, boolean complement,
                        final int from, final int end) {
        Objects.requireNonNull(c);
        final Object[] es = elementData;
        int r;
        // Optimize for initial run of survivors
        for (r = from;; r++) {
            // not include the element of index 'end'
            if (r == end)
                return false;
            if (c.contains(es[r]) != complement)
                break;
        }
        int w = r++;
        try {
            for (Object e; r < end; r++)
                if (c.contains(e = es[r]) == complement)
                    es[w++] = e;
        } catch (Throwable ex) {
            // Preserve behavioral compatibility with AbstractCollection,
            // even if c.contains() throws.
            System.arraycopy(es, r, es, w, end - r);
            w += end - r;
            throw ex;
        } finally {
            modCount += end - w;
            shiftTailOverGap(es, w, end);
        }
        return true;
    }
```



## `shiftTailOverGap()`の詳細解説

`shiftTailOverGap(Object[] es, int lo, int hi)`は、`lo`から`hi`の部分の要素を削除するために使用されます。

```java
    private void shiftTailOverGap(Object[] es, int lo, int hi) {
        // put elements, which are from hi to size-1, to the 'lo'. array will change from [1, 2, 3, ... , lo, ... , hi, ... size-1] to [1, 2, 3, ... , lo-1, hi, ... , size-1].
        System.arraycopy(es, hi, es, lo, size - hi);
        // tag useless pos as null, let GC take it over.
        for (int to = size, i = (size -= hi - lo); i < to; i++)
            es[i] = null;
    }
```



## `writeObject()/readObject()`の詳細解説

### シリアライズとデシリアライズ

シリアライズとデシリアライズとは、オブジェクトをバイトストリームに変換して転送し、バイトストリームを再びオブジェクトに復元するプロセスを指します。

シリアライズとは、Javaオブジェクトをバイトストリームに変換して、ディスクに保存したり、ネットワークを通じて他の場所に転送したりできるようにすることを指します。シリアライズは、データの永続化、リモート通信などのシナリオで使用できます。Javaでは、Serializableインターフェースを実装することでシリアライズを実現できます。

デシリアライズとは、バイトストリームを再びオブジェクトに復元して、このオブジェクトを使用できるようにするプロセスを指します。Javaでは、デシリアライズはObjectInputStreamクラスを通じて実現できます。デシリアライズを行う際には、バイトストリームとクラスローダの正確性を保証する必要があり、そうでないとClassNotFoundExceptionなどの例外が発生する可能性があります。

注意すべき点は、シリアライズとデシリアライズを行う際に、オブジェクトグラフの問題が関与する可能性があることです。あるオブジェクトが他のオブジェクトへの参照を含む場合、シリアライズとデシリアライズの際に、オブジェクトグラフ全体が正しくシリアライズおよびデシリアライズされることを保証する必要があり、そうでないとデータの不整合などの問題が発生する可能性があります。したがって、シリアライズとデシリアライズを行う際には、オブジェクトグラフ全体を考慮する必要があります。

| 長所                                                         | 短所                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| オブジェクトをバイナリストリームの形式で永続化でき、オブジェクトのリモート転送を実現 | シリアライズ後のオブジェクトは比較的かさばり、占有スペースが大きい |
| 異なるプラットフォーム、異なる言語間でデータを転送でき、言語間通信を実現 | オブジェクトのシリアライズとデシリアライズ操作に時間と性能がかかる |
| オブジェクトの保存と読み取りが便利（キャッシュ、ログ記録など） | シリアライズ後のオブジェクトは転送過程で中間者攻撃を受けやすいため、暗号化と認証が必要 |
| ディープコピーを実現でき、オブジェクトを完全に複製し、元のオブジェクトの状態に影響を与えない | オブジェクトの属性の変動が大きい場合、デシリアライズ時にクラスバージョンの不一致が発生する可能性があり、バージョン互換性の処理が必要 |
| オブジェクトの状態が保存され、必要なときにデシリアライズしてオブジェクトの状態を復元できる | シリアライズ時に機密情報が保存された場合、デシリアライズ時にデータプライバシーが漏洩しやすい |
| シリアライズとデシリアライズはオブジェクトの自己記述を実現し、メタ情報の処理が便利 | シリアライズ後のオブジェクトを圧縮および解凍する必要がある場合、性能とスペース占有の問題が発生する可能性がある |

### メソッドの説明

ArrayListの`writeObject`メソッドは、ArrayListインスタンスをバイトストリームにシリアライズするために使用されます。これは、メモリとディスク間でのオブジェクトの転送、ネットワークを跨いだオブジェクトの転送などに使用されます。

Javaでは、オブジェクトをシリアライズするには、`Serializable`インターフェースを実装する必要があります。シリアライズ時、Javaはオブジェクトをバイトシーケンスに変換し、デシリアライズ時、Javaはバイトシーケンスを元のオブジェクトに復元します。ArrayListはSerializableインターフェースを実装しているため、シリアライズ可能です。

ArrayListでは、ArrayListインスタンスをシリアライズする必要がある場合、writeObjectメソッドがArrayListインスタンスの要素を1つずつObjectOutputStreamに書き込みます。シリアライズ過程では、ArrayListの「容量」はシリアライズされず、ArrayListの要素のみがシリアライズされます。同時に、ArrayListはデシリアライズ時に`readObject`メソッドを使用してObjectInputStreamから要素を読み取り、ArrayListオブジェクトを再構築します。

注意すべき点は、ArrayList内の要素もシリアライズ可能なオブジェクトでなければならないことです。要素がシリアライズ不可能なオブジェクトの場合、シリアライズ過程でNotSerializableException例外がスローされます。

```java
    @java.io.Serial
    private void writeObject(java.io.ObjectOutputStream s)
        throws java.io.IOException {
        // Write out element count, and any hidden stuff
        int expectedModCount = modCount;
        s.defaultWriteObject();

        // Write out size as capacity for behavioral compatibility with clone()
        s.writeInt(size);

        // Write out all elements in the proper order.
        for (int i=0; i<size; i++) {
            s.writeObject(elementData[i]);
        }

        if (modCount != expectedModCount) {
            throw new ConcurrentModificationException();
        }
    }

    @java.io.Serial
    private void readObject(java.io.ObjectInputStream s)
        throws java.io.IOException, ClassNotFoundException {

        // Read in size, and any hidden stuff
        s.defaultReadObject();

        // Read in capacity
        s.readInt(); // ignored

        if (size > 0) {
            // like clone(), allocate array based upon size not capacity
            SharedSecrets.getJavaObjectInputStreamAccess().checkArray(s, Object[].class, size);
            Object[] elements = new Object[size];

            // Read in all elements in the proper order.
            for (int i = 0; i < size; i++) {
                elements[i] = s.readObject();
            }

            elementData = elements;
        } else if (size == 0) {
            elementData = EMPTY_ELEMENTDATA;
        } else {
            throw new java.io.InvalidObjectException("Invalid size: " + size);
        }
    }
```



## `Consumer.class`

Javaでは、`Consumer`は関数型インターフェースであり、抽象メソッド`void accept(T t)`を含みます。このメソッドは1つのパラメータを受け取り、何も結果を返しません。`Consumer`インターフェースは通常、オブジェクトを操作するために使用されます。例えば、オブジェクトの状態を変更したり、それを出力したりします。以下は、`Consumer`を使用して整数リストの各要素を出力する簡単な例です：

```java
import java.util.Arrays;
import java.util.List;
import java.util.function.Consumer;

public class Example {
    public static void main(String[] args) {
        List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5);
        Consumer<Integer> printer = n -> System.out.println(n);
        numbers.forEach(printer);
    }
}

```

上記の例では、整数リストを作成し、各要素を出力する`Consumer`オブジェクト`printer`を定義しました。次に`forEach`メソッドを使用してリストを走査し、各要素に対して`accept`メソッドを実行し、その要素を`printer`オブジェクトに渡します。

`Consumer`インターフェースには、複数の`Consumer`を組み合わせるために使用できるデフォルトメソッドもいくつかあります。例えば、`andThen`メソッドは2つの`Consumer`を1つに組み合わせ、順番にそれらの`accept`メソッドを実行します。例えば：

```java
import java.util.function.Consumer;

public class Example {
    public static void main(String[] args) {
        Consumer<String> first = s -> System.out.println("First: " + s);
        Consumer<String> second = s -> System.out.println("Second: " + s);
        Consumer<String> both = first.andThen(second);
        both.accept("Hello");
    }
}

```

上記の例では、2つの`Consumer`、`first`と`second`を定義し、それぞれ文字列のプレフィックスとサフィックスを出力します。次に`andThen`メソッドを使用してそれらを新しい`Consumer`オブジェクト`both`に組み合わせ、文字列"Hello"に適用します。

具体的な実装は以下の通りです：

```java
package java.util.function;

import java.util.Objects;

@FunctionalInterface
public interface Consumer<T> {

    /**
     * Performs this operation on the given argument.
     *
     * @param t the input argument
     */
    void accept