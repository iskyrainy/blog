---
title: Read Code-ArrayList
category: Tech
tag: [Java, ReadCode]
date: 2025-04-27T09:52:41+08:00
---

# ReadCode-ArrayList

## `ArrayList` implements the `RandomAccess` interface and supports random access

RandomAccess is a marker interface in Java used to indicate collections that support fast random access. If a collection implements the RandomAccess interface, its elements can be accessed directly by index without the need for iteration. Conversely, if a collection does not implement the RandomAccess interface, its elements can only be traversed through an iterator.

In Java, ArrayList implements the RandomAccess interface because it is an array-based collection and its elements can be accessed directly by index. LinkedList, on the other hand, does not implement the RandomAccess interface because it is a linked-list-based collection and its elements can only be traversed through an iterator.

The RandomAccess interface itself does not define any methods; it is only used to mark whether a collection supports fast random access. If a collection implements the RandomAccess interface, the binarySearch method provided by the Collections utility class can be used for binary search, thereby finding elements more quickly.

```JAVA
public class ArrayList<E> extends AbstractList<E>
        implements List<E>, RandomAccess, Cloneable, java.io.Serializable
```



## Detailed explanation of `modCount`

In Java collections, modCount is a counter used to record the number of structural modifications to a collection. When the structure of the collection changes, such as when adding or removing elements, the modCount counter is incremented. For example, collection classes such as ArrayList, HashMap, and HashSet all have a modCount counter.

modCount is used to support the fail-fast mechanism of collections. If, while iterating over a collection, it is detected that the value of modCount has changed, a ConcurrentModificationException is thrown. This is to avoid data inconsistency and safety issues caused by concurrent modification of a collection.

The modCount property is usually used to implement the fail-fast mechanism, so that in a multithreaded environment, if a collection is being traversed and the collection is modified during traversal, a ConcurrentModificationException can be thrown by checking the value of modCount to ensure the safety of the program.

The following is an example showing how to use modCount to implement the fail-fast mechanism in a multithreaded environment:

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

The MyList class extends the AbstractList class and implements the add, remove, get, and size methods. In the add and remove methods, the modCount property is incremented. In the iterator method, before each traversal it checks whether modCount and expectedModCount are equal; if they are not equal, a ConcurrentModificationException is thrown.

It should be noted that modCount can only catch some concurrent modification exceptions. For example, if one thread deletes an element while another thread modifies another element at the same time, no exception will be thrown. Therefore, in a concurrent environment, specialized concurrent collection classes are needed to ensure data consistency and thread safety.



## The default size of `ArrayList` is 10.

```java
private static final int DEFAULT_CAPACITY = 10;
```

The `capacity` size can be freely defined through initialization:

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



## Detailed explanation of `trimToSize`

First, use the ternary operator to determine whether there are currently elements in the ArrayList. If the current size is 0, point `elementData` to `EMPTY_ELEMENTDATA`, that is, an empty array of length 0; otherwise, use the `Arrays.copyOf()` method to copy the elements in the `elementData` array into a new array, and set the length of the new array to size. Finally, `elementData` points to the new array.

The main purpose of this operation is to reduce the memory space occupied by the ArrayList object. Since the number of elements and the memory space occupied may constantly change during actual use of an ArrayList, a large amount of wasted space may exist. Calling the `trimToSize()` method can release this idle memory space, thereby improving the memory usage efficiency of the program.

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



## Detailed explanation of `grow`

If the original `list` is not empty, use the `newLength()` method to calculate the new size of the `list`.

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



## Detailed explanation of `contains()/lastIndexOf()`

If `o == null`, traverse `elementData`; if `null` exists, return the corresponding `index`; if `o != null`, traverse `elementData` to see whether it contains `o`, and return the corresponding `index`; in all other cases, return `-1`.

Similarly, the principle of `lastindexof()` is similar. If `o == null`, traverse `elementData` from back to front; if `null` exists, return the corresponding `index`; if `o != null`, traverse `elementData` from back to front; if `o.equals(elementData[i])` exists, return the corresponding `index`; otherwise return `-1`. The source code is not pasted, as it is similar to `contains()`.

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



## Detailed explanation of `clone()`

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



## Detailed explanation of `toArray()`

It accepts a parameter a, which represents the target array to which the elements are to be converted. If the length of a is less than the `size` of the `ArrayList`, then it creates a new array of the same type and copies the elements in the `ArrayList` into that array.

If the length of a is greater than or equal to the `size` of the `ArrayList`, then the elements in the `ArrayList` are copied directly into a. If the length of a is greater than the `size` of the `ArrayList`, then the element at position `size` in a is set to `null`.

This method returns the converted array. Note that if the type of the target array is not a subtype of the element type of the `ArrayList`, the `toArray` method will return a new array. To prevent this, generics can be used by passing the type of the target array as a parameter to the `toArray` method.

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



## Detailed explanation of `set()`

Check whether `index` is valid, return the `element` at the previous `index` position, and do not change the value of `modCount`.

```java
    public E set(int index, E element) {
        rangeCheck(index);

        E oldValue = elementData(index);
        elementData[index] = element;
        return oldValue;
    }
```



## Detailed explanation of `remove()`

Use `arraycopy()` to copy the elements after `index` forward, with time complexity `O(N)`.

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

easy to understand.

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



## Detailed explanation of `equals()`

If object `o` is equal to the object pointed to by `this`, return `true` directly;

if `o` is not an instance of `List` or its subclasses, return `false`;

if `o` is an instance of `ArrayList`, call `equalsArrayList()`, otherwise call `equalsRange()`;

check `modCount`; if `modCount != expectedModCount`, throw a `ConcurrentModificationException`.

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



## Detailed explanation of `hashCode()`

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



## Detailed explanation of `addAll()`

If `a = c.toArray()` is empty, return `false`; if `a` is not empty and `a.length > (elementData.length - size)`, call `grow()` to expand `elementData`, then use `arraycopy()` to copy `a` into `elementData`.

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



## Detailed explanation of `batchRemove()`

This method accepts a parameter `c` of type `Collection`, a boolean parameter `complement`, an int parameter `from`, and an int parameter `end`. Here, `c` represents the collection of elements to be deleted, `complement` means that if true, elements not present in c are deleted; otherwise, elements present in c are deleted. from and end represent the starting and ending positions of the elements to be deleted, including from but not end.

First, the method determines the initial value of r based on the value of complement. If the element pointed to by r does not need to be deleted, r continues to move right until an element that needs to be deleted is found; at this point, r points to the first element that needs to be deleted, and w points to the position of the next element.

Then, among the subsequent elements starting from r, find an element that does not need to be deleted, move it to the position of w, and at the same time move w one position to the right. After traversing all elements within the specified range, the position pointed to by w is the position of the next element that does not need to be deleted, that is, w and the elements to its right need to be deleted.

Finally, move the elements in the element array from w to end left by w - end positions, and update modCount to indicate the number of modifications to the ArrayList.

`example:`

Suppose we have an ArrayList storing numbers, with the following contents:

```java
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

We want to delete all even-numbered elements (that is, 2, 4, 6, 8, 10). We can create a HashSet storing the even numbers, and then pass it as a parameter to the batchRemove method. The specific code is as follows:

```java
ArrayList<Integer> list = new ArrayList<>(Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
HashSet<Integer> set = new HashSet<>(Arrays.asList(2, 4, 6, 8, 10));
list.batchRemove(set, false, 0, list.size());
```

Among them, the first parameter is the HashSet storing the even numbers, the second parameter is false, indicating that all elements in the HashSet should be deleted, the third parameter is 0, indicating that scanning starts from the head of the list, and the fourth parameter is the size of the list, indicating scanning to the end of the list.

Inside the batchRemove method, the position of the first element that needs to be deleted is first found through a loop, and then, starting from this position, elements that do not need to be deleted are moved forward, and finally the remaining elements are deleted. The specific process is as follows:

1. Start scanning from position 0, find element 1, which does not need to be deleted, and continue scanning.
2. Start scanning from position 1, find element 2, which needs to be deleted, and break out of the loop.
3. Record position 1 as r, start from position 2, move the element 1 that does not need to be deleted forward by one position, overwriting element 2 at position 1.

```java
[1, 3, 4, 5, 6, 7, 8, 9, 10, 10]
   r
   w
```

4. Start scanning from position 2, find element 3, which does not need to be deleted, move it to position w (1), and increment w by 1.

```java
[1, 3, 4, 5, 6, 7, 8, 9, 10, 10]
   r
      w
```

5. Start scanning from position 3, find element 4, which needs to be deleted, and skip it.

6. Start scanning from position 4, find element 5, which does not need to be deleted, move it to position w (2), and increment w by 1.

```java
[1, 3, 5, 5, 6, 7, 8, 9, 10, 10]
   r
         w
```

7. Start scanning from position 5, find element 6, which needs to be deleted, and skip it.

8. Start scanning from position 6, find element 7, which does not need to be deleted, move it to position w (3), and increment w by 1.

```java
[1, 3, 5, 7, 6, 7, 8, 9, 10, 10]
   r
            w
```

go on until over `try` block.

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



## Detailed explanation of `shiftTailOverGap()`

`shiftTailOverGap(Object[] es, int lo, int hi)` is used to delete the elements from `lo` to `gi`.

```java
    private void shiftTailOverGap(Object[] es, int lo, int hi) {
        // put elements, which are from hi to size-1, to the 'lo'. array will change from [1, 2, 3, ... , lo, ... , hi, ... size-1] to [1, 2, 3, ... , lo-1, hi, ... , size-1].
        System.arraycopy(es, hi, es, lo, size - hi);
        // tag useless pos as null, let GC take it over.
        for (int to = size, i = (size -= hi - lo); i < to; i++)
            es[i] = null;
    }
```



## Detailed explanation of `writeObject()/readObject()`

### Serialization and deserialization

Serialization and deserialization refer to the process of converting an object into a byte stream and transmitting it, as well as restoring the byte stream back into an object.

Serialization refers to converting a Java object into a byte stream so that it can be stored on disk or transmitted over the network to other places. Serialization can be used in scenarios such as data persistence and remote communication. In Java, serialization can be implemented by implementing the Serializable interface.

Deserialization refers to the process of restoring a byte stream back into an object so that the object can be used. In Java, deserialization can be implemented through the ObjectInputStream class. During deserialization, the correctness of the byte stream and the class loader must be ensured; otherwise, exceptions such as ClassNotFoundException may occur.

It should be noted that during serialization and deserialization, issues related to the object graph may be involved. If an object contains references to other objects, then during serialization and deserialization, the entire object graph must be correctly serialized and deserialized; otherwise, problems such as data inconsistency may occur. Therefore, when performing serialization and deserialization, the entire object graph needs to be considered.

| Advantages                                                   | Disadvantages                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| Objects can be persisted in the form of a binary stream, enabling remote transmission of objects | Serialized objects are relatively bulky and occupy a large amount of space |
| Data can be transmitted between different platforms and different languages, enabling cross-language communication | The serialization and deserialization operations of objects consume time and performance |
| It is convenient to store and read objects, such as in caching and logging | During transmission, serialized objects are vulnerable to man-in-the-middle attacks, so encryption and authentication are required |
| Deep copy can be implemented, that is, an object can be completely copied without affecting the state of the original object | If the object's properties change greatly, class version inconsistency may occur during deserialization, requiring version compatibility handling |
| The state of the object is saved and can be deserialized when needed to restore the object's state | If sensitive information is saved during serialization, data privacy may be leaked during deserialization |
| Serialization and deserialization realize the self-description of objects, making it convenient to process metadata | If serialized objects need to be compressed and decompressed, performance and space occupation issues may arise |

### Method description

ArrayList's `writeObject` method is used to serialize an ArrayList instance into a byte stream. It is used to transmit objects between memory and disk, across networks, and so on.

In Java, for an object to be serialized, it needs to implement the `Serializable` interface. During serialization, Java converts the object into a byte sequence, and during deserialization, Java restores the byte sequence into the original object. ArrayList implements the Serializable interface, so it can be serialized.

In ArrayList, when an ArrayList instance needs to be serialized, the writeObject method writes the elements of the ArrayList instance one by one into the ObjectOutputStream. During the serialization process, the "capacity" of the ArrayList is not serialized; only the elements of the ArrayList are serialized. At the same time, during deserialization, ArrayList uses the `readObject` method to read elements from the ObjectInputStream and reconstruct the ArrayList object.

It should be noted that the elements in ArrayList must also be serializable objects. If an element is a non-serializable object, a NotSerializableException will be thrown during the serialization process.

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

In Java, `Consumer` is a functional interface that contains an abstract method `void accept(T t)`, which takes one parameter and returns no result. The `Consumer` interface is usually used to perform operations on an object, such as modifying the object's state or printing it out. Below is a simple example that uses `Consumer` to print each element in a list of integers:

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

In the example above, we create a list of integers and define a `Consumer` object `printer`, which prints each element. Then we use the `forEach` method to traverse the list and execute the `accept` method on each element, passing the element to the `printer` object.

The `Consumer` interface also has some default methods that can be used to combine multiple `Consumer`s, such as the `andThen` method, which combines two `Consumer`s into one and executes their `accept` methods in sequence. For example:

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

In the example above, we define two `Consumer`s, `first` and `second`, which respectively print a prefix and a suffix for the string. Then we use the `andThen` method to combine them into a new `Consumer` object `both`, and apply it to the string "Hello".

The specific implementation is as follows:

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
    void accept(T t);

    /**
     * Returns a composed {@code Consumer} that performs, in sequence, this
     * operation followed by the {@code after} operation. If performing either
     * operation throws an exception, it is relayed to the caller of the
     * composed operation.  If performing this operation throws an exception,
     * the {@code after} operation will not be performed.
     *
     * @param after the operation to perform after this operation
     * @return a composed {@code Consumer} that performs in sequence this
     * operation followed by the {@code after} operation
     * @throws NullPointerException if {@code after} is null
     */
    default Consumer<T> andThen(Consumer<? super T> after) {
        Objects.requireNonNull(after);
        return (T t) -> { accept(t); after.accept(t); };
    }
}
```



## Detailed explanation of `forEach(Consumer<? super E> action)`

`forEach()` receives a `Consumer` object and repeatedly calls `action.accept(elementData[i])` on the elements in `elementData`, thereby traversing `elementData`.

```java
    @Override
    public void forEach(Consumer<? super E> action) {
        Objects.requireNonNull(action);
        final int expectedModCount = modCount;
        @SuppressWarnings("unchecked")
        final E[] elementData = (E[]) this.elementData;
        final int size = this.size;
        for (int i=0; modCount == expectedModCount && i < size; i++) {
            action.accept(elementData[i]);
        }
        if (modCount != expectedModCount) {
            throw new ConcurrentModificationException();
        }
    }
```



## `spliterator()`

`spliterator()` is a default method defined in the `java.util.Collection` interface, used to support split iteration of collections.

It returns a `Spliterator` object, used to perform split iteration operations in a collection. `Spliterator` is an interface for traversing and splitting elements, supporting parallel operations.

The default implementation of the `spliterator()` method uses the `Spliterators.spliterator()` method to create a new `Spliterator` object for split iteration over the entire collection.

If a class implementing the `Collection` interface has a better splitting strategy, it can override the `spliterator()` method to return a better `Spliterator` object. For example, for `ArrayList`, its `spliterator()` method returns an `ArrayListSpliterator` object, which uses a more efficient splitting strategy to traverse the array.

The `Spliterator` interface defines some methods for supporting split iteration operations. Common methods include:

- `tryAdvance(Consumer<? super T> action)`: attempts to perform the specified action on the next element and returns whether there are remaining elements.
- `forEachRemaining(Consumer<? super T> action)`: performs the specified action on all remaining elements.
- `trySplit()`: first determines whether there are still elements available for splitting. If the number of remaining elements is less than or equal to 1, or if it has already been split into a sub-partition, it returns `null`. Otherwise, it calculates the size of the sub-partition and updates the current partition's `fence` to the sub-partition's `origin`. It returns a new `Spliterator` object for traversing the second half of the elements. If it cannot split, it returns null.
- `estimateSize()`: estimates how many elements still need to be traversed.
- `characteristics()`: gets the characteristic flags of the `Spliterator`. For example, whether it supports parallel iteration, whether it is ordered, and so on.

Using the `spliterator()` method, split iteration operations can be performed on collections, and it is very suitable for parallel processing of large collections.





## Detailed explanation of `nBits(int n)`

Based on parameter n, return a bitmap array of size n.

```java
    private static long[] nBits(int n) {
        // 'n-1' because the array start from index zero;
        // '(n-1) >> 6' because long type has 64 bits;
        // '+1' is to get the int nums.
        return new long[((n - 1) >> 6) + 1];
    }
```



## Detailed explanation of `setBit(long [] bits, int i)`

Mark the bitmap.

```java
    private static void setBit(long[] bits, int i) {
        // i's pos is computed by 'i >> 6';
        // from '1L << i' get a nums with just first legel bit is '1';
        // compute two nums with '|', set