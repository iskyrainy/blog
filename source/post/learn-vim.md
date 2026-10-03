---
title: Learn Vim
category: Tech
tag: Vim
date: 2025-09-17T15:35:49+08:00
---


# Vim

## **move**

**hjkl** is the core and most basic motions in Vim. They allow you to move the cursor by one space in every direction.

![Moving around in Vim with hjkl](https://www.barbarianmeetscoding.com/images/vim-basics-hjkl.jpg)

## **change mode**

Use **ESC/ 'Ctrl-[' / 'Ctrl-Z'** and **i/a** switch between **Normal Mode** and **Insert Mode**.

![Going from normal mode to insert mode and back](https://www.barbarianmeetscoding.com/images/vim-basics-insert-to-normal.jpg)

## **basic actions**

In Vim, **Ctrl-C** is not means the copy action, but we use **y(for yank)** as we using in Vim.

Also, we use **p(for paste)** do the same work as **Ctrl-V**.

- Use **`b`** (**b**ack) to jump to the beginning of a word backwards
- Use **`e`** (**e**nd) to jump to the end of a word
- Use **`ge`** to jump to the end of a word backwards

If you want to move WORD by WORD you can use the capitalized equivalents of the motions described earlier (**`W`**, **`B`**, **`E`**, **`gE`**).

- Use **`f{character}`** (**f**ind) to move to the next occurrence of a character in a line. For instance, **`f"`** sends you to the next occurrence of a double quote.
- If your target is behind the cursor you can use **`F{character}`** to find the previous occurrence of a character
- Use **`t{character}`** to move the cursor just before the next occurrence of a character (think of `t{character}` of moving your cursor un**t**il that character).
- Again, you can use **`T{character}`** to do the same as `t{character}` but backwards

After using **`f{character}`** you can type **`;`** to go to the next occurrence of the character or **`,`** to go to the previous one. **You can see the `;` and `,` as commands for repeating the last character search**.

- **`0`**: Moves to the **first character of a line**
- **`^`**: Moves to the **first non-blank character of a line**
- **`$`**: Moves to the **end of a line**
- **`g_`**: Moves to the **non-blank character at the end of a line**
- **`}`** jumps entire paragraphs **downwards**
- **`{`** similarly but **upwards**
- **`CTRL-D`** lets you **move down half a page** by scrolling the page
- **`CTRL-U`** lets you **move up half a page** also by scrolling
- Use **`/{pattern}`** to **search forward** inside a file
- Use **`?{pattern}`** to **search backwards**

There you can perform some editing if you want and later use **`n`** to jump to the next match (or **`N`** for the previous one). **You can think of `n` as repeating a search**.

Vim loves saving you time: Type **`/<Enter>`** or **`?<Enter>`** anytime to run the last search (forwards or backwards). Or use **\*** to do a search for the word under the cursor (**`#`** to do the same backwards).

**Counts are numbers which let you multiply the effect of a command**. You can use them by prefixing any command with a count like so:

**{count}{command}**

For instance:

- **`2w`** allows us to move the cursor 2 words forward.
- **`5j`** changes your cursor position to 5 lines below.
- **`3;`** lets you go to the next third occurrence of a character.
- **`2/baby`** sends you flying to the second occurrence of `baby` in a document.

- Use **`gd`** to jump to definition of whatever is under your cursor.
- Use **`gf`** to jump to a file in an import.
- Type **`gg`** to go to the top of the file.
- Use **`{line}gg`** to go to a specific line.
- Use **`G`** to go to the end of the file.
- Type **`%`** jump to matching **`({[]})`**.

## **a series of operators**

use operators and motions together by following any of these patterns:

- {operator}{count}{motion}
- {count}{operator}{motion}

![Vim operators](https://www.barbarianmeetscoding.com/images/vim-operators.jpg)

- The **operator** determines which action you want to perform: deleting, changing, yanking, formatting, etc.
- The **count** allows you to multiply the effect of an operator by performing an action a *count* number of times.
- The **motion** represents the piece of text to which to apply the action defined by the operator.

For instance, the `d2w` combination allows you to **delete two words**.

![An example operator d2w delete two words](https://www.barbarianmeetscoding.com/images/vim-operators-d2w.jpg)

- Use **`d5j`** to delete 5 lines downwards
- Type **`df'`** to delete everything in the current line from the cursor until the first occurrence of the **`'`** character (including the character itself)
- Or type **`dt'`** to do like the above example but excluding the character (so up until or just before the **`'`** character)
- Use **`d/hello`** to delete everything until the first occurrence of **`hello`**
- Type **`ggdG`** to delete a complete document

## **useful operators**

![Some useful Vim operators](https://www.barbarianmeetscoding.com/images/vim-operators-commands.jpg)

- **`c`** (**c**hange): Change deletes a piece of text and then sends you into *Insert mode* so that you can continue typing, changing the original text into something else. The change operator is like the **`d`** and **`i`** commands combined into one. This duality makes it the most useful operator
- **`y`** (**y**ank): Copy in Vim jargon
- **`p`** (**p**ut): Paste in Vim jargon
- **`g~`** (switch case): Changes letters from lowercase to uppercase and back. Alternatively, use **`gu`** to make something lowercase and **`gU`** to make something uppercase
- **`>`** (shift right): Adds indentation
- **`<`** (shift left): Removes indentation
- **`=`** (format code): Formats code
- **Double an operator to make it operate on a whole line**: **`dd`** deletes a whole line, **`cc`** changes a whole line, etc.
- **Capitalize an operator to have it perform a stronger (or alternate) version of its default behavior**: **`D`** deletes from the cursor to the end of the line, **`C`** changes to the end of a line, **`Y`** like **`yy`** copies a complete line, **`P`** pastes something before the cursor, etc.

## **text objects**

The way that you specify a text object within a command is by combining the letter **`a`** (**a** text object plus whitespace) or **`i`** (**inner** object without whitespace) with a character that represents a text object itself:

![Vim Text Objects](https://www.barbarianmeetscoding.com/images/vim-text-objects.jpg)

The built-in text-objects are:

![Vim Text Objects Commands](https://www.barbarianmeetscoding.com/images/vim-text-objects-commands.jpg)

- **`w`** for **w**ord
- **`s`** for **s**entence
- **`'`**, **`"`**, **```** for quotes
- **`p`** for **p**aragraph
- **`b`** (or **`(`**, **`)`**) for block surrounded by **`()`,**
- **`B`** (or **`{`**, **`}`**) for block surrounded by **`{}`**
- **`<`**, **`>`** for a block surrounded by **`<>`**
- **`[`**, **`]`** for a block surrounded by **`[]`**
- **`t`** for tag.

So in order to delete different bits of text you could any of the following commands:

- **`daw`** to **d**elete **a** **w**ord (plus trailing whitespace)
- **`ciw`** to **c**hange **i**nner **w**ord
- **`das`** to **d**elete **a** **s**entence (**`dis`** to delete inner sentence)
- **`da"`** to delete something in double quotes including the quotes themselves (**`di"`** deletes only the content **i**nside the quotes and spares the quotes)
- **`ci"`** to change something inside double quotes
- **`dap`** to delete a paragraph
- **`dab`** **`da(`** or **`da)`** to delete a block surrounded by **`(`**
- **`daB`** **`da{`** or **`da}`** to delete a block surrounded by **`{`**
- **`dat`** to delete an HTML tag
- **`cit`** to change the contents of an HTML tag

**Combining text objects with operators is extremely powerful** and you’ll find yourself relying on them very frequently. Stuff like `cit`, `ci"` and `cib` is just brilliant.

**The `.` command allows you to repeat the last change you made**.

- **`x`** is equivalent to **`dl`** and deletes the character under the cursor
- **`X`** is equivalent to **`dh`** and deletes the character before the cursor
- **`s`** is equivalent to **`ch`**, deletes the character under the cursor and puts you into *Insert mode*
- **`~`** to switch case for a single character

- Type **`u`** and you’ll undo your last change,
- Type **`CTRL-R`** and you’ll redo it,

## **Insert mode**

- **`i`** for **i**nsert and,
- **`a`** for **a**ppend.
- **`I`** puts you in *Insert mode* at the beginning of the current line whilst,
- **`A`** puts you in *Insert mode* at the end.

![Insert mode commands](https://www.barbarianmeetscoding.com/images/vim-insert-mode.jpg)

1. **`o`** inserts a new line below the current one and drops you into Insert mode (mnemonic **o**pen a line below)
2. **`O`** inserts a new line above the current one and also drops you into Insert mode
3. **`gi`** puts you into *Insert mode* at the last place you made a change. This is great if you drop from *Insert mode* by mistake and want to go back where you were and continue typing. (This behavior is slightly different to Vim where `gi` sends you to the last place you left *Insert mode*).

![More Insert mode commands](https://www.barbarianmeetscoding.com/images/vim-more-insert-mode.jpg)

- **`CTRL-h`** lets you delete the **last character** you typed
- **`CTRL-w`** lets you delete the **last word** you typed
- **`CTRL-u`** lets you delete the **last line** you typed

## **Select text and Visual mode**

**Visual Mode is the Vim equivalent to selecting text with a mouse**.

![Visual mode commands](https://www.barbarianmeetscoding.com/images/vim-visual-mode-commands.jpg)

- **`v`** for visual mode **character-wise**. This mode lets you select text character by character
- **`V`** for visual mode **line-wise**. This other one lets you select text line by line
- **`<C-V>`** for visual mode **block-wise**. This last mode lets you select text using rectangular blocks

## **operating on search**

**`gn`** works as follows:

1. If you are on top of a search match, it selects the match in *Visual mode*.
2. If you are in *Visual mode*, it extends your current selection until the end of the next match.
3. (and the best part) If you are in *Operator-pending mode*, **it operates on the next match**.

What does this all mean? **It means that by taking advantage of `gn` we can operate on the next match using just one keystroke**. With **`gn`** the **`.`** command encapsulates the meaning of **“apply this change to the next match**

## **copying and pasting**

![Vim copy paste commands](https://www.barbarianmeetscoding.com/images/vim-copy-paste-commands.jpg)

### **yank**

**`y`** is an operator. You can combine it with any of the motions and text-objects you’ve learned to yank stuff to your heart’s desire:

- **`yl`** **y**anks a **l**etter,
- **`yaw`** **y**anks a **w**ord,
- **`yas`** **y**anks a **s**entence
- **`yi(`** **y**anks everything within **`(`** and so on…

If you double **`y`** as in **`yy`** you get **a linewise operator** like with **`dd`** and **`cc`** and yank a whole line. The **`Y`** command also yanks a complete line. I prefer to use **`yy`** but feel free to choose whichever you want.

### **paste**

In order to paste things you use the **`p`** command and its variants:

- **`p`** pastes something after the cursor
- **`P`** pastes something before the cursor
- **`gp`** same as **`p`** but puts the cursor after the pasted selection
- **`gP`** same as **`P`** and puts the cursor after the pasted selection

That’s an astounding amount of pasting flexibility right there.

Pasting in Vim is kind of special and the behavior of **`p`** and **`P`** depend on whether you’ve yanked characters or lines. If you’ve yanked **characters** then pasting will put those characters after or before the cursor (no surprises there). If you’ve yanked **lines**, however, pasting will put those lines after or before the line where the cursor is resting on.

![Vim useful copy pasting](https://www.barbarianmeetscoding.com/images/vim-useful-copy-pasting.jpg)

### **register**

*Do you remember `d` and `c` from 10-ish minutes ago?* Well, when I said that they deleted text into oblivion **I LIED!** They actually **cut** things.

Registers are like a special clipboard where you can save multiple things at once. The following registers are super useful:

- The **unnamed register** **`"`** is where you copy and cut stuff to, when you don’t explicitly specify a register. The default register if you will.
- The **named registers** **`a-z`** are registers you can use explicitly to copy and cut text at will
- The **yank register** **`0`** stores the last thing you have yanked (copied)
- The **cut registers** **`1-9`** store the last 9 things you cut by using either the delete or the change command

For instance, **`"ayas`** yanks a sentence and stores it in register **`a`**. Now if you want to paste it somewhere else, you can type **`"ap`**. Alternatively, using the capitalized version a register (i.e. **`A`** instead of **`a`**) appends whatever you copy or cut into that register.

The **yank register** lets you have access to what you copied last via the **`y`** command. This is helpful because deletes and changes don’t overwrite this register like they do the unnamed register.

The **cut registers** give you access to the last 9 things you deleted or changed. This is great if there’s some text that you deleted earlier and which you want to recover.

At any point in time, you can use the `:reg` command to see what is in your registers. Or you can type `:reg {register}` to inspect the contents of a specific register.

**In insert mode**, Using `CTRL-R {register}` you can paste the contents of a register after the cursor:

- **`CTRL-R "`** pastes the contents of the unnamed register
- **`CTRL-R a`** pastes the contents of register **`a`**
- **`CTRL-R 0`** pastes the contents of the yank register

## **Command-line mode**

### **create a new file**

A common Ex command is `:edit`. It lets you open or creating a file by typing:

`:edit {relative-path-to-file}`

### **saving or close files**

- Use **`:write`** (shorthand **`:w`**) to save a file
- Use **`:quit`** (shorthand **`:q`**) to close a file

- Use **`:write!`** (shorthand **`:w!`**) to save a file even if it’s been saved already or if it is readonly
- Use **`:quit!`** (shorthand **`:q!`**) to close a file without saving.
- Use **`:wq`** to save and close a file

- Use **`:wall`** (shorthand **`:wa`**) to save all files
- Use **`:qall`** (shorthand **`:qa`**) to close all files
- Use **`:wqall`** (shorthand **`:wqa`**) to save and close all files
- Use **`:qall!`** (shorthand **`:qa!`**) to close all files without saving

### **deleting multiple lines at once**

These text-editing Ex commands take the following shape:

**:[range]command[options]**

- Using numbers (e.g. **`:10,12d`** to delete lines 10, 11 and 12)
- Using offsets (e.g. **`:10,+2d`** to delete lines 10, 11 and 12)
- Using the current line represented by **`.`** (e.g. **`:.,+2d`** to delete the current line and the next two ones)
- Using **`%`** to represent the whole file (e.g. **`:%d`** to delete the whole file)
- Using **`0`** to represent the beginning of the file (e.g. **`:0,+10d`** to delete the first 10 lines)
- Using **`$`** to represent the end of the file (e.g. **`:.,$d`** to delete from the current line to the end of the file)
- If you use *Visual mode* to make a text selection and then type **`:`** your command line area will be pre-populated with the following gobbledygook: **`:'<,'>`** which is a special range that represents the current visual text selection. (e.g. **`:'<,'>d`** means delete the current text selection)

Just like you can repeat *Normal mode* commands with the dot operator, Ex commands also have a repeater command. Type **`@:`** and you will repeat the last ex command, from then on you can repeat it again with **`@@`**.

 `:substitute`. It allows you to substitute arbitrary bits of text for others of your choosing. The shape of this command is:

**:[range]s/{pattern}/{substitute}/{flags}**

Where:

- **`range`** defines the range in which we’ll apply the substitution
- **`pattern`** is a search pattern that describes the text we want to change. Like **`/{pattern}`** it supports regular expressions.
- **`substitute`** is the text we want to substitute
- **`flags`** let us set options that configure the substitution

If we want to change **all occurrences in the current line** then we need to add the **`g`** flag or *global* flag.

if we want to change **all occurrences for a whole file** we just need to specify the entire file as a range with `%`.

In addition to the **`g`** flag we can use:

- **`i`** for case insensitive searches
- **`c`** to confirm each and every substitution

## **splits and tabs**

### **split**

- Use the **`:sp {relative-path-to-file}`** command to open a file in a horizontal **sp**lit.
- Use the **`:vsp {relative-path-to-file}`** command to open a file in a **v**ertical **sp**lit.
- **`<CTRL-W> S`** to open horizontal split (mnemonic **W**indow and **S**plit).
- **`<CTRL-W> V`** to open a vertical split (mnemonic **V**ertical).

Using either of these commands will open a split to the same file that you’re currently editing. So after creating the split, you’ll need to type **`CMD-P`** on Mac or **`CTRL-P`** on Windows/Linux to open a new file in that split.

![Window splitting in Vim](https://www.barbarianmeetscoding.com/images/vim-window-splitting.jpg)

You can move between splits using with **`CTRL-W`** + **`hjkl`**.

### **tab**

In Visual Studio Code you can open several tabs within a split. In order to do so:

- Use **`:tabnew {file}`** to open a file in a new tab
- Use **`:tabn`** (**`:tabnext`**) to go to the **n**ext tab
- Use **`:tabp`** (**`:tabprevious`**) to go to the **p**revious tab
- Use **`:tabo`** (**`:tabonly`**) to close all other tabs

## **Surrounding**

The *surround* plugin for Vim is a handy plugin for adding, removing, or changing the symbols surrounding text, such as brackets and quotes. It allows you to quickly add or remove matching brackets or quotes without having to type them manually. Additionally, the plugin can easily add or remove tags within HTML or XML tags.

For example, when you need to add double quotes around a word or sentence, you can move the cursor to the word or sentence and enter the command "s" followed by the " key to wrap the selected text in double quotes. If you want to use other types of quotes or brackets, just replace " with other symbols.

Some common commands for the surround plugin are as follows:

- ys{motion}surround：Wrap the specified text area in the specified brackets or quotation marks
- ds{char}：Removes specified characters (such as brackets or quotes) and merges the surrounding text
- cs{char1}{char2}：Replaces char1 with char2 and updates the surrounding text
- S{char1}{char2}：Replaces char1 of the selected text with char2 and updates the surrounding text

## **custom mappings**

A *custom mapping* in Vim is the equivalent to a shortcut in other editors but with a strong focus on melodies of keys that are so natural to Vim.

## **multiple cursors**

If you want to **add multiple cursors based on word search** you need to:

1. Move the cursor on top of a word in your code.
2. Type **`<CMD-D>`** (**`CTRL-D`** on Windows/Linux) or **`gb`** to add another cursor. This puts Vim into *Visual mode* and ready to operate on the word you have selected.
3. Type **`<CMD-D>`** (**`CTRL-D`** on Windows/Linux) or **`gb`** to continue adding cursors until you’re done.
4. Now you can perform an action in *Visual mode* (delete, change, etc) or,
5. Go back to *Normal mode* with **`<ESC>`** and type any *Normal mode* command keeping the multiple cursors.

Here another way to add multiple cursors:
1. Type **`<CMD-V>`** into vision mode;
2. With **`j/k`** choose lines;
3. (Optional) Type **`$`** go to the end of lines;
4. Type **`I/A`** start to edit lines;

## Cheet Sheet

![vim-shortcuts-2560x1600.png](https://i.postimg.cc/fRXvdTJp/vim-shortcuts-2560x1600.png)

Links:
- [Vim help files](https://vimhelp.org/)
- [Cheet Sheet](https://www.barbarianmeetscoding.com/boost-your-coding-fu-with-vscode-and-vim/cheatsheet/)

